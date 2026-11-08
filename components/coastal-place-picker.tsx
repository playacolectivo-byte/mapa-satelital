'use client';
import {projectCoastLabel,projectPlaceLabel} from '@/lib/project-coast-labels';

export type MunicipalPhotoGroup={municipality:string;years:number[];places:{id:string;name:string}[]};
export function CoastalPlacePicker({label,groups,value,title,disabled,loading,error,showYears,onSelect,onRetry}:{label?:string;groups:MunicipalPhotoGroup[];value:string;title:string;disabled:boolean;loading:boolean;error:boolean;showYears:boolean;onSelect:(id:string)=>void;onRetry:()=>void}){
 return <label className="coastal-place-picker">
  <span>{label?projectCoastLabel(label):'Explorar toda la costa'}</span>
  <select className="coastal-place-select" aria-label="Explorar toda la costa" disabled={disabled} title={title} value={value} onChange={event=>event.target.value==='__retry__'?onRetry():onSelect(event.target.value)}>
   <option value="" disabled>{loading?'Cargando municipios…':'Selecciona un municipio'}</option>
   {error&&<option value="__retry__">Reintentar cargar localidades</option>}
   {groups.map(group=><optgroup key={group.municipality} label={projectCoastLabel(group.municipality)+(showYears?(group.years.length?' · Esri: '+group.years.join(', '):' · sin años Esri verificados en este periodo'):'')}>
    <option value={'municipality:'+group.municipality}>{projectCoastLabel(group.municipality)}</option>
    {group.places.map(place=><option key={place.id} value={place.id}>{projectPlaceLabel(place.name)}</option>)}
   </optgroup>)}
  </select>
 </label>;
}
