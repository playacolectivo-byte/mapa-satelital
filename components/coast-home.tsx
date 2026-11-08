'use client';
import {useEffect,useRef,useState} from 'react';
import pages from '@/lib/generated/municipality-pages.json';
import {municipalityHref} from '@/lib/municipal-pages';
import {projectCoastLabel,hasProjectCoastLabel,PROJECT_COAST_LABEL_NOTE} from '@/lib/project-coast-labels';
import type {Map as LeafletMap} from 'leaflet';
import 'leaflet/dist/leaflet.css';
export default function CoastHome(){
 const host=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null);const [error,setError]=useState(false);
 useEffect(()=>{let cancelled=false;void import('leaflet').then(L=>{if(cancelled||!host.current)return;const m=L.map(host.current,{zoomControl:false,attributionControl:false,minZoom:8,maxZoom:12,maxBounds:[[20.5,-90.7],[22.1,-87.1]],maxBoundsViscosity:1});map.current=m;
 L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19}).on('tileerror',()=>setError(true)).addTo(m);m.fitBounds([[20.8,-90.5],[21.7,-87.5]],{padding:[30,80]});
 const labels:{coordinate:[number,number];width:number;marker:import('leaflet').Marker}[]=[];
 for(const p of pages){const label=projectCoastLabel(p.name),a=document.createElement('a');a.href=municipalityHref(p.slug);a.textContent=label;a.className='coast-home-marker';a.setAttribute('aria-label','Abrir mapa de '+label);if(hasProjectCoastLabel(p.name))a.title=PROJECT_COAST_LABEL_NOTE;const marker=L.marker([p.coordinates[1],p.coordinates[0]],{keyboard:false,icon:L.divIcon({html:a,className:'coast-home-label',iconSize:[0,0]})}).addTo(m);labels.push({coordinate:p.coordinates as [number,number],width:label.length*7+25,marker});}
 const update=()=>{const used:{x:number;y:number;width:number}[]=[];for(const l of labels){const p=m.latLngToContainerPoint([l.coordinate[1],l.coordinate[0]]),el=l.marker.getElement();const visible=!used.some(q=>Math.abs(q.x-p.x)<(q.width+l.width)/2+8&&Math.abs(q.y-p.y)<35);if(el)el.style.display=visible?'':'none';if(visible)used.push({x:p.x,y:p.y,width:l.width});}};m.on('moveend zoomend resize',update);update();
 }).catch(()=>setError(true));return()=>{cancelled=true;map.current?.remove();map.current=null;};},[]);
 return <main className="coast-home"><div ref={host} className="coast-home-map" aria-label="Vista panorámica de la costa de Yucatán"/>
  <header className="coast-home-title"><span>Colectivo Playa</span><h1>Explora la costa</h1><p>Elige un municipio para ver sus años y cambios.</p></header>
  <nav className="coast-home-menu" aria-label="Tramos de la costa">{pages.map(p=><a href={municipalityHref(p.slug)} key={p.slug} title={hasProjectCoastLabel(p.name)?PROJECT_COAST_LABEL_NOTE:undefined}>{projectCoastLabel(p.name)}<span aria-hidden="true">↗</span></a>)}</nav>
  <div className="coast-home-actions"><button onClick={()=>map.current?.zoomIn()} aria-label="Acercar panorámica">+</button><button onClick={()=>map.current?.zoomOut()} aria-label="Alejar panorámica">−</button></div>
  {error&&<output className="coast-home-notice">La imagen puede tardar. Puedes abrir cualquier municipio desde el menú.</output>}
  <small className="coast-home-credit">Vista general de referencia · © Esri · proveedores de World Imagery</small>
 </main>;
}
