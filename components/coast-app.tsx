'use client';
import {lazy,Suspense,useEffect,useState} from 'react';
import pages from '@/lib/generated/municipality-pages.json';
import {routeMunicipality,type MunicipalityScope} from '@/lib/municipal-pages';
const Explorer=lazy(()=>import('./explorer'));
const CoastHome=lazy(()=>import('./coast-home'));
export default function CoastApp({reviewMode=false}:{reviewMode?:boolean}){
 const slug=routeMunicipality(window.location.pathname),page=pages.find(p=>p.slug===slug);
 const [scope,setScope]=useState<MunicipalityScope|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(!page)return;const controller=new AbortController();const timer=window.setTimeout(()=>{controller.abort();setFailed(true);},20000);
  void fetch('/data/municipalities/'+page.slug+'/index.json',{signal:controller.signal,cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Sección no disponible');return r.json();}).then(value=>{const data=value as MunicipalityScope;if(data.municipality.slug!==page.slug||data.municipality.name!==page.name||data.reviews_applied!==true)throw new Error('Municipio incompatible');if(!controller.signal.aborted)setScope(data);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);}).finally(()=>window.clearTimeout(timer));return()=>{window.clearTimeout(timer);controller.abort();};
 },[page?.slug,attempt]);
 if(slug&&!page)return <main className="map-startup"><h1>Municipio no disponible</h1><a href="/">Volver al menú principal</a></main>;
 if(page&&!scope)return <main className="map-startup" role="status"><p>{failed?'No se pudo cargar '+page.name:'Abriendo '+page.name+'…'}</p>{failed&&<><button onClick={()=>{setFailed(false);setAttempt(n=>n+1);}}>Reintentar</button><a href="/">Menú principal</a></>}</main>;
 return <Suspense fallback={<div className="map-startup" role="status">Cargando mapa…</div>}>{page&&scope?<Explorer key={page.slug} reviewMode={reviewMode} municipalityScope={scope}/>:<CoastHome/>}</Suspense>;
}
