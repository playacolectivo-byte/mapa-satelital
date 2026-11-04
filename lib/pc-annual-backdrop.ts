import definitions from './generated/pc-annual-backdrops.json' with {type:'json'};
import type {AnnualBackdrop} from './annual-backdrop';
import {ResourceCache} from './resource-cache.ts';
const configs=definitions as Record<string,{request:Record<string,unknown>}>;
const cache=new ResourceCache<AnnualBackdrop>(4,4);
export const hasPcAnnualBackdrop=(year:number)=>!!configs[String(year)];
export function loadPcAnnualBackdrop(year:number,attempt:number,signal:AbortSignal):Promise<AnnualBackdrop>{
 if(!hasPcAnnualBackdrop(year))return Promise.reject(new Error('Unreviewed annual backdrop'));
 // Search links are temporary. Register the same audited public search again
 // hourly/on explicit retry, rather than shipping an expiring signed URL.
 return cache.read(year+':'+attempt+':'+Math.floor(Date.now()/3600000),signal,async sharedSignal=>{
  const controller=new AbortController(),abort=()=>controller.abort();sharedSignal.addEventListener('abort',abort,{once:true});if(sharedSignal.aborted)abort();
  const timer=setTimeout(abort,15000);
  try{
   const response=await fetch('https://planetarycomputer.microsoft.com/api/data/v1/mosaic/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(configs[String(year)].request),signal:controller.signal});
   if(!response.ok)throw new Error('Mosaic registration HTTP '+response.status);
   const registration=await response.json() as {links?:{href:string;rel:string}[]};
   const metadataUrl=registration.links?.find(l=>l.rel==='tilejson')?.href;
   if(!metadataUrl || !metadataUrl.startsWith('https://planetarycomputer.microsoft.com/api/data/v1/mosaic/'))throw new Error('Invalid mosaic response');
   const params=new URLSearchParams({collection:'sentinel-2-l2a',assets:'visual',asset_bidx:'visual|1,2,3',nodata:'0',format:'png'});
   const meta=await fetch(metadataUrl+'?'+params,{signal:controller.signal});if(!meta.ok)throw new Error('Mosaic metadata HTTP '+meta.status);
   const json=await meta.json() as {tiles?:string[]};let tiles=json.tiles?.[0];
   if(!tiles || !tiles.startsWith('https://planetarycomputer.microsoft.com/api/data/v1/mosaic/') || !tiles.includes('{z}/{x}/{y}'))throw new Error('Invalid annual tile template');
   if(!tiles.includes('collection='))tiles+='&collection=sentinel-2-l2a';
   const label='Sentinel-2 · 10 m',capture=year===2026?'2026 · 1 ene–28 oct':'Mosaico de '+year;
   return {year,provider:'pc',frame:{key:'pc-annual:'+year+':'+metadataUrl.split('/').at(-2),url:tiles,options:{tileSize:256,maxNativeZoom:14,minZoom:8,maxZoom:20,noWrap:true,updateWhenIdle:true,updateWhenZooming:false,keepBuffer:1,className:'temporal-raster-frame'}},label,attribution:'Copernicus Sentinel-2 / Microsoft Planetary Computer · '+year,licenseUrl:'https://dataspace.copernicus.eu/explore-data/terms-and-conditions',info:{title:'Sentinel-2 · mosaico temporal '+year,capture,captureDate:null,provider:'Copernicus / Microsoft Planetary Computer',resolution:'10 m por píxel original · sin detalle de casas',url:metadataUrl,note:'Mosaico explorable de capturas del mismo año, ordenadas por nubosidad de escena ≤10%. No es una toma de un día ni un mosaico anual corregido de mareas. Pueden verse nubes residuales y cambios de color. '+(year===2026?'Periodo cerrado al28oct2026; el año todavía no está completo. ':'')+'Revisión de18localidades/13municipios con muestras opacas; no prueba que cada píxel de toda la costa esté libre de nubes. Fondo visual: no se derivaron nuevas cifras de erosión de este RGB.'}};
  }finally{clearTimeout(timer);sharedSignal.removeEventListener('abort',abort);}
 });
}
