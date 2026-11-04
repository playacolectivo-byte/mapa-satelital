'use client';
import type {ReactNode} from 'react';
import {ImageryChoice,type ImageSource,type SourceAvailability} from './imagery-choice';

export type MapDateOption={value:string;label:string};
/** Dates describe received photographs; analysis years remain separate. */
export function DateSourcePicker({source,value,options,onDate,onSource,onRetry,status,caption,notice,availability,label='Fecha de la imagen',detailLabel='Esri HD',emptyLabel='Mapa de referencia · consultando fechas'}:{
 source:ImageSource;value:string;options:MapDateOption[];onDate:(value:string)=>void;onSource:(source:ImageSource)=>void;onInfo:()=>void;onRetry?:()=>void;status:'loading'|'ready'|'error';caption:string;notice?:ReactNode;availability?:SourceAvailability;label?:string;detailLabel?:string;emptyLabel?:string;
}){
 const present=options.some(option=>option.value===value);
 return <section className="timeline-pill map-date-picker" aria-label="Fecha y fuente del mapa" aria-busy={status==='loading'}>
  <ImageryChoice value={source} onChange={onSource} detailLabel={detailLabel} availability={availability}/>
  <span className="timeline-divider" aria-hidden="true"/>
  <label className="map-date-field"><span>{label}</span><select aria-label={label} value={present?value:''} disabled={!options.length} onChange={event=>onDate(event.target.value)}>
   {!present&&<option value="">{options.length?'Elegir una fecha disponible':emptyLabel}</option>}
   {options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
  </select></label>
  <div className="map-date-caption"><span>{caption}</span>{status==='error'&&<small role="alert">Imagen solicitada incompleta.</small>}</div>
  {status==='loading'&&<output className="map-date-progress"><i aria-hidden="true"/>Cargando…</output>}
  {status==='error'&&onRetry&&<button className="map-date-retry" onClick={onRetry}>Reintentar</button>}
  {notice&&<output className="map-date-notice">{notice}</output>}
 </section>;
}
