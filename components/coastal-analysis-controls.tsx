'use client';
import {projectCoastLabel,hasProjectCoastLabel,PROJECT_COAST_LABEL_NOTE} from '@/lib/project-coast-labels';
import type {CoastalResultView} from '@/lib/coastal-result-view';
import type {CoastalAlignmentSummary} from '@/lib/coastal-image-alignment';

export function CoastalAnalysisControls({scopeLabel,year,displayedYear=year,years,municipality,onYearChange,comparableCount,referenceCount,visibleCount=null,status,onRetry,resultView='scenario',alignmentSummary,reviewedOnly=false,reviewedMunicipality=false}:{scopeLabel?:string;reviewedOnly?:boolean;reviewedMunicipality?:boolean;
 year:number;displayedYear?:number|null;years:number[];municipality:string|null;onYearChange:(year:number)=>void;
 comparableCount:number;referenceCount:number;visibleCount?:number|null;status:'loading'|'ready'|'error';onRetry:()=>void;
 resultView?:CoastalResultView;
 alignmentSummary?:CoastalAlignmentSummary;
}) {
 const present=years.includes(year),scenario=resultView==='scenario';
 scopeLabel=scopeLabel?projectCoastLabel(scopeLabel):scopeLabel;
 const projectNames=municipality!==null&&hasProjectCoastLabel(municipality);
 return <section className="coastal-analysis-controls" aria-label="Comparación de posiciones de costa">
  <strong className="coastal-analysis-title">Cambio de la costa</strong>
  {projectNames&&<p className="coastal-inline-status">{PROJECT_COAST_LABEL_NOTE} <a href="/data/project-coast-labels-20261105.md" target="_blank" rel="noreferrer">Fuentes y nombres</a></p>}
  <div className="coastal-analysis-selects">
   <label className="analysis-year-select"><span>Año del análisis</span><select aria-label="Año del análisis de erosión" value={present?year:''} disabled={!scenario&&!municipality||!years.length} onChange={event=>{const next=Number(event.target.value);if(years.includes(next))onYearChange(next);}}>
    {!present&&<option value="">{municipality?'Sin comparación disponible':'Elige un municipio'}</option>}
    {years.map(value=><option key={value} value={value}>{value}</option>)}
   </select></label>
   <div className="coastal-fixed-reference"><span>Referencia</span><strong>{reviewedOnly?'1 ago 2011':reviewedMunicipality?'2011':'2010 / 2011'}</strong></div>
  </div>
  {scenario&&<output className="coastal-estimate-label">{year} · {reviewedMunicipality?'fotos revisadas · pendientes sin metros':reviewedOnly?'fotos revisadas'+(year===2013?' · 3 de 22 puntos':''):'fotos o modelo, según el punto'}</output>}
  <div className="coastal-change-key is-compact" aria-label="Colores de las barras de cambio"><span><i style={{borderColor:'#f46c55'}}/>Hacia tierra</span><span><i style={{borderColor:'#52d08b'}}/>Hacia el agua</span><span><i style={{borderColor:'#becdd4'}}/>{scenario?'Por revisar / incierta':'Incierta'}</span></div>
  <p className="coastal-inline-status">{reviewedOnly||reviewedMunicipality?'Punto blanco: orilla de 2011. Sin foto compatible: punto pendiente, sin metros.':scenario?'Punto blanco: referencia fija. Trazo discontinuo: estimación.':'Pulsa una barra para ver metros y fuentes.'}</p>
  {displayedYear!==null&&status==='ready'&&<output className="coastal-inline-status" aria-label="Cobertura de la comparación">{scenario?<>{(visibleCount??comparableCount+referenceCount).toLocaleString('es-MX')} perfiles en esta vista · {scopeLabel??'13 municipios'}.</>:visibleCount===0?'Sin una pareja de fotos aceptada en este tramo.':comparableCount>0?<>{(visibleCount??comparableCount).toLocaleString('es-MX')} {visibleCount===null?'comparaciones':'resultados en esta vista'} · cobertura parcial.</>:referenceCount>0?<>{(visibleCount??referenceCount).toLocaleString('es-MX')} referencias · aún sin cambio calculado.</>:'Sin comparaciones disponibles en esta fecha.'}</output>}
  {status==='loading'&&<output className="coastal-inline-status">{displayedYear!==null&&displayedYear!==year?'Cargando '+year+' · visible '+displayedYear:'Cargando '+year+'…'}</output>}
  {status==='error'&&<p className="coastal-inline-status" role="alert">No se pudieron cargar las comparaciones. <button onClick={onRetry}>Reintentar</button></p>}
  <details className="coastal-reading-details">
   <summary>Datos y método</summary>
   <div className="coastal-analysis-details-body">
    {reviewedMunicipality?<>
     <p>La referencia de 2011 permanece fija. Cada extremo se revisa en su fotografía fechada y los metros se recalculan desde esa misma base. Cuando falta la foto, el borde no es interpretable o falta la revisión, el perfil queda pendiente sin una cifra de cambio.</p>
     <p>Interpretación visual asistida por ChatGPT, contrastada en revisiones independientes. Sin correcciones de marea, oleaje o registro relativo ni validación de campo.</p>
     <a className="compact-link" href="/data/shorelines/photo-alignment/municipal-review-20261105-method.md" target="_blank" rel="noreferrer">Método, fechas y pendientes</a>
    </>:reviewedOnly?<>
     <p>22 perfiles del extremo oeste de Progreso, revisados en cada foto disponible. La referencia del 1 de agosto de 2011 permanece fija. En 2013 hay tres posiciones; los otros 19 puntos no tienen una foto de ese año en esta edición.</p>
     <p>Interpretación visual asistida por ChatGPT. No se aplicaron correcciones de marea, oleaje o registro ni validación de campo.</p>
     <a className="compact-link" href="/data/shorelines/photo-alignment/progreso-oeste-20261105-method.md" target="_blank" rel="noreferrer">Método y fechas revisadas</a>
     <a className="compact-link" href="/data/shorelines/photo-alignment/manual-progreso-oeste-20261105.json" target="_blank" rel="noreferrer">Lecturas revisadas por fecha</a>
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
