import type { WaybackItem, WaybackMetadata } from '@esri/wayback-core';
import {PointMetadataStore} from './point-metadata-store.ts';
let pointStore:PointMetadataStore|undefined;
function exactPointStore(){
  if(!pointStore){let storage:Storage|undefined;try{if(typeof window!=='undefined')storage=window.localStorage;}catch{}pointStore=new PointMetadataStore(storage);}
  return pointStore;
}
/** Hydrate every successful exact-point result before scheduling fresh work.
 * Reading a different edition, point or scale cannot borrow a cached date. */
export function cachedEsriPointMetadata(item:WaybackItem,longitude:number,latitude:number,zoom:number):WaybackMetadata|null|undefined{
  return exactPointStore().read([item.metadataLayerUrl,longitude,latitude,zoom].join('|'))?.value;
}
export type RenderedEsriMetadata=WaybackMetadata&{nativeZoom?:number;tileZoom:number};
const renderedKey=(item:WaybackItem,longitude:number,latitude:number,zoom:number)=>['rendered-v2',item.metadataLayerUrl,longitude,latitude,zoom].join('|');
export function cachedRenderedEsriMetadata(item:WaybackItem,longitude:number,latitude:number,zoom:number):RenderedEsriMetadata|null|undefined{
  return exactPointStore().read(renderedKey(item,longitude,latitude,zoom))?.value as RenderedEsriMetadata|null|undefined;
}
const tileAt=(longitude:number,latitude:number,z:number)=>({x:Math.floor((longitude+180)/360*2**z),y:Math.floor((1-Math.asinh(Math.tan(latitude*Math.PI/180))/Math.PI)/2*2**z)});
function nativeKey(item:WaybackItem,longitude:number,latitude:number){const {x,y}=tileAt(longitude,latitude,20);return 'native:'+item.itemURL.split('/tile/')[0]+'/'+item.releaseNum+'/'+x+'/'+y;}
export function cachedEsriNativeZoom(item:WaybackItem,longitude:number,latitude:number):number|undefined{
  return completed.get(nativeKey(item,longitude,latitude)) as number|undefined;
}
/** Availability belongs to each edition, never the currently selected one.
 * Only an explicit valid zero permits checking a coarser level. HTTP errors
 * stop the read; no alternate endpoint or service is attempted. */
export function fetchEsriNativeZoom(item:WaybackItem,longitude:number,latitude:number,signal:AbortSignal):Promise<number>{
  if(!validItem(item))return Promise.reject(new Error('Invalid Esri edition'));
  return shared(nativeKey(item,longitude,latitude),async ownSignal=>{
    const base=item.itemURL.split('/tile/')[0];
    for(let z=20;z>=10;z--){
      const {x,y}=tileAt(longitude,latitude,z);
      const response=await jsonWithBudget(`${base}/tilemap/${item.releaseNum}/${z}/${y}/${x}`,ownSignal,4096) as {valid?:boolean;data?:number[]};
      if(!response.valid||!Array.isArray(response.data)||![0,1].includes(response.data[0]))throw new Error('Invalid Esri availability');
      if(response.data[0]===1)return z;
    }
    throw new Error('No Esri tile at this point');
  },signal);
}
/** Query metadata at the edition's actual rendered level, while keeping the
 * inventory scope independent of which photograph the visitor selects. */
export async function fetchRenderedEsriMetadata(item:WaybackItem,longitude:number,latitude:number,zoom:number,signal:AbortSignal):Promise<RenderedEsriMetadata|null>{
  if(!validItem(item)||!Number.isFinite(longitude)||!Number.isFinite(latitude)||!Number.isInteger(zoom)||zoom<10||zoom>20)throw new Error('Invalid Esri rendered query');
  const key=renderedKey(item,longitude,latitude,zoom),saved=cachedRenderedEsriMetadata(item,longitude,latitude,zoom);
  if(saved!==undefined)return saved;
  let nativeZoom=cachedEsriNativeZoom(item,longitude,latitude);
  let tileZoom:number;
  if(nativeZoom!==undefined)tileZoom=Math.min(zoom,nativeZoom);
  else if(zoom===20){nativeZoom=await fetchEsriNativeZoom(item,longitude,latitude,signal);tileZoom=nativeZoom;}
  else{
    // A wide view needs only its displayed level, not an inventory of every
    // higher scale. The selected photo's native-detail lookup is shared.
    tileZoom=await shared(nativeKey(item,longitude,latitude)+':level-'+zoom,async ownSignal=>{
      const base=item.itemURL.split('/tile/')[0];
      for(let z=zoom;z>=10;z--){
        const {x,y}=tileAt(longitude,latitude,z);
        const response=await jsonWithBudget(`${base}/tilemap/${item.releaseNum}/${z}/${y}/${x}`,ownSignal,4096) as {valid?:boolean;data?:number[]};
        if(!response.valid||!Array.isArray(response.data)||![0,1].includes(response.data[0]))throw new Error('Invalid Esri availability');
        if(response.data[0]===1)return z;
      }
      throw new Error('No Esri tile at this point');
    },signal);
    // A gap at an overview level only limits this rendering. It does not
    // prove that higher-resolution tiles are absent at the same point.
    // Only the explicit top-down native lookup may cache a global ceiling.
    if(tileZoom<zoom)nativeZoom=tileZoom;
  }
  const metadata=await fetchEsriPointMetadata(item,longitude,latitude,tileZoom,signal);
  const value=metadata?{...metadata,nativeZoom,tileZoom}:null;
  if(!signal.aborted)exactPointStore().write(key,value);
  return value;
}

export type ReceivedSite={name:string;coordinates:[number,number];zoom:number;values:Record<number,WaybackMetadata>};
export type ReceivedCatalogue={items:WaybackItem[];sites:ReceivedSite[]};
export const ESRI_CONFIG_URL='https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json';

const completed=new Map<string,unknown>();
type SharedRequest={controller:AbortController;promise:Promise<unknown>;consumers:number};
const requests=new Map<string,SharedRequest>();
const aborted=()=>new DOMException('Aborted','AbortError');

/** A bounded, abortable read of the same public endpoints used by Wayback.
 * No image downloads/comparisons, bbox queries or alternate routes. */
async function jsonWithBudget(url:string,signal:AbortSignal|undefined,maximumBytes:number,timeoutMs=12000):Promise<unknown>{
  if(signal?.aborted)throw aborted();
  const controller=new AbortController(),abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,timeoutMs);
  try{
    const response=await fetch(url,{signal:controller.signal});
    if(!response.ok){await response.body?.cancel();throw new Error('Esri HTTP '+response.status);}
    const declared=Number(response.headers.get('content-length'));
    if(declared>maximumBytes){await response.body?.cancel();throw new Error('Esri response exceeds budget');}
    if(!response.body)return await response.json() as unknown;
    const reader=response.body.getReader(),decoder=new TextDecoder();
    let total=0,text='';
    try{
      for(;;){
        const {done,value}=await reader.read();if(done)break;
        total+=value.byteLength;
        if(total>maximumBytes){await reader.cancel();throw new Error('Esri response exceeds budget');}
        text+=decoder.decode(value,{stream:true});
      }
      text+=decoder.decode();
    }finally{reader.releaseLock();}
    return JSON.parse(text) as unknown;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

/** Shared work survives StrictMode's immediate detach/reattach. Once all real
 * consumers leave, the underlying fetch is cancelled, including its body. */
function shared<T>(key:string,read:(signal:AbortSignal)=>Promise<T>,signal:AbortSignal):Promise<T>{
  if(signal.aborted)return Promise.reject(aborted());
  if(completed.has(key))return Promise.resolve(completed.get(key) as T);
  let request=requests.get(key);
  if(!request || request.controller.signal.aborted){
    const controller=new AbortController();
    const entry:SharedRequest={controller,consumers:0,promise:Promise.resolve()};
    entry.promise=Promise.resolve().then(()=>read(controller.signal)).then(value=>{
      if(controller.signal.aborted)throw aborted();
      completed.set(key,value);
      while(completed.size>256){const oldest=completed.keys().next().value!;completed.delete(oldest);}
      return value;
    }).finally(()=>{if(requests.get(key)===entry)requests.delete(key);});
    requests.set(key,entry);request=entry;
  }
  const active=request;active.consumers++;
  return new Promise<T>((resolve,reject)=>{
    let settled=false;
    const finish=(run:()=>void)=>{
      if(settled)return;settled=true;signal.removeEventListener('abort',cancel);active.consumers--;
      queueMicrotask(()=>{if(!active.consumers && requests.get(key)===active)active.controller.abort();});
      run();
    };
    const cancel=()=>finish(()=>reject(aborted()));
    signal.addEventListener('abort',cancel,{once:true});
    active.promise.then(value=>finish(()=>resolve(value as T)),error=>finish(()=>reject(error)));
    if(signal.aborted)cancel();
  });
}

function validItem(value:unknown):value is WaybackItem{
  if(!value || typeof value!=='object')return false;
  const p=value as Partial<WaybackItem>;
  return Number.isInteger(p.releaseNum) && Number(p.releaseNum)>0 && typeof p.releaseDateLabel==='string' &&
    typeof p.itemURL==='string' && p.itemURL.startsWith('https://') &&
    typeof p.metadataLayerUrl==='string' && p.metadataLayerUrl.startsWith('https://');
}

export function parseEsriEditions(raw:unknown,today=new Date().toISOString().slice(0,10)):WaybackItem[]{
  if(!raw || typeof raw!=='object' || Array.isArray(raw))throw new Error('Invalid Esri catalogue');
  const items:WaybackItem[]=[];
  for(const [release,value]of Object.entries(raw)){
    if(!value || typeof value!=='object')continue;
    const p=value as Record<string,unknown>;
    const label=typeof p.itemTitle==='string'?p.itemTitle.match(/\d{4}-\d{2}-\d{2}/)?.[0]:null;
    if(!label || label>today)continue;
    const releaseDatetime=Date.parse(label+'T00:00:00Z');
    const candidate={...p,releaseNum:Number(release),releaseDateLabel:label,releaseDatetime};
    if(Number.isFinite(releaseDatetime) && validItem(candidate))items.push(candidate);
  }
  if(!items.length)throw new Error('Empty Esri catalogue');
  return items.sort((a,b)=>a.releaseDateLabel.localeCompare(b.releaseDateLabel)||a.releaseNum-b.releaseNum);
}

export function loadReceivedEsriCatalogue(signal:AbortSignal):Promise<ReceivedCatalogue>{
  return shared('received',async ownSignal=>{
    const value=await jsonWithBudget('/data/history/esri-local-captures.json',ownSignal,1024*1024) as Partial<ReceivedCatalogue>;
    if(!Array.isArray(value.items) || !value.items.every(validItem) || !Array.isArray(value.sites))throw new Error('Invalid received Esri catalogue');
    return value as ReceivedCatalogue;
  },signal);
}

export function loadEsriEditions(signal:AbortSignal):Promise<WaybackItem[]>{
  return shared('official-config',async ownSignal=>parseEsriEditions(await jsonWithBudget(ESRI_CONFIG_URL,ownSignal,3*1024*1024)),signal);
}

/** Exact point and metadata level. Mirrors Wayback's published field/query
 * contract, with a real fetch deadline rather than a detached SDK promise. */
export async function fetchEsriPointMetadata(item:WaybackItem,longitude:number,latitude:number,zoom:number,signal?:AbortSignal):Promise<WaybackMetadata|null>{
  if(!validItem(item) || !Number.isFinite(longitude) || !Number.isFinite(latitude) || !Number.isInteger(zoom) || zoom<10 || zoom>23)throw new Error('Invalid Esri point query');
  if(signal?.aborted)throw aborted();
  const cacheKey=[item.metadataLayerUrl,longitude,latitude,zoom].join('|');
  const store=exactPointStore(),cached=store.read(cacheKey);
  if(cached)return cached.value;
  const params=new URLSearchParams({f:'json',where:'1=1',outFields:'SRC_DATE2,NICE_DESC,SRC_DESC,SAMP_RES,SRC_ACC',geometry:JSON.stringify({spatialReference:{wkid:4326},x:longitude,y:latitude}),returnGeometry:'false',geometryType:'esriGeometryPoint',spatialRel:'esriSpatialRelIntersects'});
  const endpoint=item.metadataLayerUrl.replace(/\/$/,'')+'/'+(23-zoom)+'/query?'+params.toString();
  const data=await jsonWithBudget(endpoint,signal,256*1024) as {error?:unknown;features?:{attributes?:Record<string,unknown>}[]};
  if(data.error)throw new Error('Esri metadata service error');
  if(!Array.isArray(data.features))throw new Error('Invalid Esri metadata response');
  const p=data.features[0]?.attributes;if(!p){store.write(cacheKey,null);return null;}
  if(typeof p.SRC_DATE2!=='number' || !Number.isFinite(p.SRC_DATE2))return null;
  const value={date:p.SRC_DATE2,provider:typeof p.NICE_DESC==='string'?p.NICE_DESC:'Proveedor sin dato',source:typeof p.SRC_DESC==='string'?p.SRC_DESC:'Fuente sin dato',resolution:typeof p.SAMP_RES==='number'?p.SAMP_RES:NaN,accuracy:typeof p.SRC_ACC==='number'?p.SRC_ACC:NaN};
  if(!signal?.aborted)store.write(cacheKey,value);
  return value;
}
