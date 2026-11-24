'use client';
import {hasProjectCoastLabel,PROJECT_COAST_LABEL_NOTE} from '@/lib/project-coast-labels';
import {datedReviewForMunicipality} from '@/lib/dated-image-reviews';
import type {CoastalResultView} from '@/lib/coastal-result-view';
import type {CoastalAlignmentSummary} from '@/lib/coastal-image-alignment';
import {regionalAlternativeMethod} from '@/lib/regional-shoreline-alternatives';

export function CoastalAnalysisControls({year,displayedYear=year,years,referenceYear,municipality,onYearChange,comparableCount,referenceCount,pendingStations,status,onRetry,resultView='scenario',alignmentSummary,reviewedMunicipality=false}:{scopeLabel?:string;reviewedOnly?:boolean;reviewedMunicipality?:boolean;referenceYear?:number;
 year:number;displayedYear?:number|null;years:number[];municipality:string|null;onYearChange:(year:number)=>void;
 comparableCount:number;referenceCount:number;visibleCount?:number|null;pendingStations?:number;status:'loading'|'ready'|'error';onRetry:()=>void;
 resultView?:CoastalResultView;
 alignmentSummary?:CoastalAlignmentSummary;
}) {
 const present=years.includes(year),scenario=resultView==='scenario',review=datedReviewForMunicipality(municipality),interpreted=scenario&&!!review;
 const exactProgreso=municipality==='Progreso';
 const projectNames=municipality!==null&&hasProjectCoastLabel(municipality);
 const municipalMethod=municipality==='Hunucmá'||municipality==='Yobaín'?'/data/shorelines/photo-alignment/hunucma-yobain-method.md':'/data/shorelines/photo-alignment/municipal-review-20261105-method.md';
 return <section className="coastal-analysis-controls" aria-label="Comparación de posiciones de costa">
  <strong className="coastal-analysis-title">Cambio de la costa</strong>
  {projectNames&&<p className="coastal-inline-status">{PROJECT_COAST_LABEL_NOTE} <a href="/data/project-coast-labels-20261105.md" target="_blank" rel="noreferrer">Fuentes y nombres</a></p>}
  <label className="analysis-year-select">
   <span>Año del análisis</span>
   <span className="analysis-year-field">
    <select
     aria-label="Año del análisis de erosión"
     value={present?year:''}
     disabled={(!scenario&&!municipality)||!years.length}
     onChange={event=>{
      const next=Number(event.target.value);
      if(years.includes(next))onYearChange(next);
     }}
    >
     {!present&&<option value="">{municipality?'Sin comparación disponible':'Elige un municipio'}</option>}
     {years.map(value=><option key={value} value={value}>{value}{value===referenceYear?' · referencia':''}</option>)}
    </select>
   </span>
  </label>
  {scenario&&<output className="coastal-estimate-label">{year} · {interpreted?'orilla interpretada en fotos':exactProgreso?'comparaciones de fotos revisadas':reviewedMunicipality?'fotos revisadas · pendientes sin metros':'fotos o modelo, según el punto'}</output>}
  <div className="coastal-change-key is-compact" aria-label="Colores de las barras de cambio"><span><i style={{borderColor:'#f46c55'}}/>Hacia tierra</span><span><i style={{borderColor:'#52d08b'}}/>Hacia el agua</span><span><i style={{borderColor:'#becdd4'}}/>{scenario&&!exactProgreso?'Por revisar / incierta':'Incierta'}</span></div>
  {status==='loading'&&<output className="coastal-inline-status">{displayedYear!==null&&displayedYear!==year?'Cargando '+year+' · visible '+displayedYear:'Cargando '+year+'…'}</output>}
  {status==='error'&&<p className="coastal-inline-status" role="alert">No se pudieron cargar las comparaciones. <button onClick={onRetry}>Reintentar</button></p>}
  <details className="coastal-reading-details">
   <summary>Datos y método</summary>
   {pendingStations!==undefined&&<p className="coastal-inline-status">Estaciones cada 100 m. Cada barra conserva el perfil fotografiado más cercano disponible. Un círculo vacío indica que falta una comparación compatible para esa estación.</p>}
   <div className="coastal-analysis-details-body">
    {interpreted?<>
     <p>{review!.profiles} perfiles de playa revisados en {review!.capture_dates} fechas de captura. La base fija es la primera foto interpretable de cada punto, preferentemente 2010 o 2011.</p>
     <p>Las barras comparan posiciones leídas en las fotos. Se omiten las lecturas ocultas o incompatibles; gris indica que la dirección no se distingue del error de posición.</p>
     <p>Revisión asistida por ChatGPT. Sin corrección de marea ni validación de campo.</p>
     <a className="compact-link" href={review!.method_url} target="_blank" rel="noreferrer">Método, fechas y resultados</a>
    </>:reviewedMunicipality?<>
     <p>{exactProgreso?'Referencia fija de 2011. Las barras muestran perfiles con dos posiciones leídas en fotos compatibles. Las lecturas pendientes quedan registradas en el estudio.':'Referencia fija de 2011. Cada extremo corresponde a su foto fechada; los puntos sin una comparación compatible quedan pendientes, sin metros.'}</p>
     <p>Revisión asistida por ChatGPT, sin validación de campo ni corrección de marea.</p>
     <a className="compact-link" href={municipalMethod} target="_blank" rel="noreferrer">Método, fechas y pendientes</a>
     {exactProgreso&&<a className="compact-link" href="/data/shorelines/photo-alignment/progreso-chuburna-2012.md" target="_blank" rel="noreferrer">Cobertura de Chuburná en 2012</a>}
     {['Hunucmá','Yobaín'].includes(municipality??'')&&<a className="compact-link" href={regionalAlternativeMethod} target="_blank" rel="noreferrer">Imágenes alternativas revisadas</a>}
    </>:scenario?<>
     <p>{alignmentSummary?<>{alignmentSummary.audited.toLocaleString('es-MX')} perfiles auditados; {alignmentSummary.beachProfiles.toLocaleString('es-MX')} de playa. Muelles, rompeolas y costa vegetada conservan su contexto en las otras capas.</>:'Revisión de posiciones en los 13 municipios.'}</p>
     <p>{alignmentSummary?<>{alignmentSummary.photoPositions.toLocaleString('es-MX')} posiciones interpretadas en la foto; {alignmentSummary.spatialPositions.toLocaleString('es-MX')} ubicaciones interpoladas; {alignmentSummary.pendingPositions.toLocaleString('es-MX')} por revisar. Las barras mantienen una referencia fija de 2010/2011. Cuando falta una posición se identifica la reconstrucción estimada.</>:'Las barras conservan una referencia fija. Cada ficha distingue fotos, interpolaciones y modelo.'}</p>
     <p>Investigación asistida por ChatGPT. Interpretación preliminar sin corrección de marea, oleaje ni validación de campo.</p>
     <a className="compact-link" href="/data/shorelines/photo-alignment/position-method.md" target="_blank" rel="noreferrer">Revisión de posiciones y cifras</a>
     <a className="compact-link" href="/data/shorelines/scenario/values.csv.gz" download>Cifras originales por punto y año</a>
    </>:<>
    <p>{displayedYear===null?'Preparando la comparación…':<>{municipality??'Elige un municipio'} · {comparableCount.toLocaleString('es-MX')} comparaciones{referenceCount?' · '+referenceCount.toLocaleString('es-MX')+' referencias':''} visibles en {displayedYear}.</>}</p>
    <p>Base fotográfica: 2010 o, si falta, 2011. Gris en el inicio significa referencia. Los puntos sin pareja aceptada se omiten.</p>
    <p>Interpretación asistida por ChatGPT, sin validación de campo ni corrección de marea u oleaje.</p>
    <a className="compact-link" href="/data/shorelines/photo-alignment/visual-review.json" target="_blank" rel="noreferrer">Revisión visual y exclusiones</a>
    <a className="compact-link" href="/data/shorelines/photo-alignment/method.md" target="_blank" rel="noreferrer">Método y fuentes</a>
    </>}
   </div>
  </details>
 </section>;
}
