import type {Bounds} from './view';
export type MunicipalityPage={name:string;slug:string;bounds:Bounds;navigation_bounds:Bounds;coordinates:[number,number]};
type Asset={url:string;gzip_url:string;sha256:string;bytes:number};
export type MunicipalityScope={municipality:MunicipalityPage;assets:Record<string,Asset>;model:Asset;photos:Asset;road_search:Asset;original_photo_sha256:string;reviews_applied:true};
export const municipalityHref=(slug:string)=>'/municipio/'+encodeURIComponent(slug)+'/';
export function routeMunicipality(path:string):string|null{
 const match=path.match(/^\/municipio\/([a-z0-9-]+)\/?$/);return match?.[1]??null;
}
export async function scopeAsset<T>(asset:Asset,signal:AbortSignal):Promise<T>{
 if(!asset.url.startsWith('/data/municipalities/')||!/[a-f0-9]{64}/.test(asset.sha256))return Promise.reject(new Error('Sección municipal incompatible'));
 const {fetchJsonAsset}=await import('./data-delivery');const controller=new AbortController();const abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();const timer=setTimeout(abort,20000);try{return await fetchJsonAsset<T>(asset.url+'?v='+asset.sha256,controller.signal,asset.gzip_url+'?v='+asset.sha256);}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
}
export async function getMunicipalJson<T>(scope:MunicipalityScope|undefined,path:string,signal:AbortSignal):Promise<T>{
 const asset=scope?.assets[path];if(asset)return scopeAsset<T>(asset,signal);const {getJson}=await import('./data-delivery');return getJson<T>(path,signal);
}
