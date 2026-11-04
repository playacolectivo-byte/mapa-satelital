'use client';
import {useId,useRef,useState,type ReactNode,type CSSProperties,type PointerEvent,type KeyboardEvent} from 'react';
import {researchSeries,type ResearchSeries} from '@/lib/problems';
export type {CoastalChapter} from '@/lib/coastal-chapters';
import type {CoastalChapter} from '@/lib/coastal-chapters';
export function CoastalPeriodSections({chapter,onChapter,children,series,onSeries,count,status,onRetry,historicalEvidence,onPartialYear}:{
 chapter:CoastalChapter;onChapter:(chapter:CoastalChapter)=>void;children:ReactNode;
 series:ResearchSeries;onSeries:(series:ResearchSeries)=>void;count:number;status:'loading'|'ready'|'error';onRetry:()=>void;
 historicalEvidence?:ReactNode;onPartialYear?:(year:number)=>void;
}){
 const panel=useRef<HTMLElement>(null);
 const panelId=useId();
 const [minimized,setMinimized]=useState(false);
 const [collapsedChapter,setCollapsedChapter]=useState<CoastalChapter|null>(null);
 const [size,setSize]=useState<{width:number;height:number}|null>(null);
 const resizing=useRef<{pointer:number;x:number;y:number;width:number;height:number;maxWidth:number;maxHeight:number}|null>(null);
 const expanded=collapsedChapter!==chapter;
 const limits=()=>{
  const element=panel.current!;
  const box=element.getBoundingClientRect();
  const host=element.parentElement!.getBoundingClientRect();
  return {maxWidth:Math.min(560,host.right-box.left-12),maxHeight:parseFloat(getComputedStyle(element).maxHeight)||host.bottom-box.top-120};
 };
 const fit=(width:number,height:number,bounds:ReturnType<typeof limits>)=>({width:Math.min(bounds.maxWidth,Math.max(240,width)),height:Math.min(bounds.maxHeight,Math.max(280,height))});
 const startResize=(event:PointerEvent<HTMLButtonElement>)=>{
  if(event.button!==0)return;
  event.preventDefault();event.stopPropagation();
  const box=panel.current!.getBoundingClientRect();
  resizing.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,width:box.width,height:box.height,...limits()};
  event.currentTarget.setPointerCapture(event.pointerId);
 };
 const moveResize=(event:PointerEvent<HTMLButtonElement>)=>{
  const start=resizing.current;
  if(start?.pointer!==event.pointerId)return;
  event.preventDefault();event.stopPropagation();
  setSize(fit(start.width+event.clientX-start.x,start.height+event.clientY-start.y,start));
 };
 const keyboardResize=(event:KeyboardEvent<HTMLButtonElement>)=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();
  const box=panel.current!.getBoundingClientRect(),step=event.shiftKey?40:16;
  setSize(fit(box.width+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),box.height+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0),limits()));
 };
 const toggleChapter=(id:CoastalChapter)=>{
  if(chapter===id)setCollapsedChapter(expanded?id:null);
  else{setCollapsedChapter(null);onChapter(id);}
 };
 const entries=[['current','2010–2026','Comparaciones del proyecto'],['alec','1986–2021 · Alec et al.','Investigación publicada'],['historical','1910–1985','Dinámica catastral, almanaques y fototecas']] as const;
 return <aside ref={panel} className={'coastal-period-sections'+(minimized?' is-minimized':'')+(!expanded?' is-folded':'')} aria-label="Periodos de investigación costera" style={size?{'--coastal-panel-width':size.width+'px','--coastal-panel-height':size.height+'px'} as CSSProperties:undefined}>
  <header className="coastal-period-toolbar"><span>Estudios</span><button type="button" aria-label={minimized?'Ampliar panel de estudios':'Minimizar panel de estudios'} title={minimized?'Ampliar panel':'Minimizar panel'} aria-expanded={!minimized} aria-controls={panelId} onClick={()=>setMinimized(value=>!value)}>{minimized?'+':'−'}</button></header>
  <div id={panelId} className="coastal-period-items" hidden={minimized}>
  {entries.map(([id,title,subtitle])=><section key={id} className={chapter===id&&expanded?'is-expanded':undefined}>
   <button type="button" className="coastal-period-heading" aria-label={(chapter===id&&expanded?'Minimizar ':'Ampliar ')+title} aria-expanded={chapter===id&&expanded} aria-controls={'coastal-chapter-'+id} onClick={()=>toggleChapter(id)}><span>{title}<small>{subtitle}</small></span><span className="coastal-period-toggle" aria-hidden="true">{chapter===id&&expanded?'−':'+'}</span></button>
   <div id={'coastal-chapter-'+id} hidden={chapter!==id||!expanded} className="coastal-period-content">
    {chapter===id&&(id==='current'?children:id==='alec'?<>
     <p>Elige el periodo y pulsa una barra para ver el resultado.</p>
     <p className="partial-ortho-actions">Ortofotos parciales: <button onClick={()=>onPartialYear?.(1995)}>1995 · 2 m</button>{' '}<button onClick={()=>onPartialYear?.(2005)}>2005 · 1 m</button></p>
     <label>Periodo del estudio<select aria-label="Periodo de Alec" value={series} onChange={event=>onSeries(event.target.value as ResearchSeries)}>{[...researchSeries].reverse().map(item=><option key={item.id} value={item.id}>{item.period} · {item.name}</option>)}</select></label>
     <output aria-live="polite">{status==='loading'?'Cargando el estudio…':status==='error'?'No se pudo cargar el estudio.':count.toLocaleString('es-MX')+' sitios con datos.'}</output>
     {status==='error'&&<button className="coastal-popup-retry" onClick={onRetry}>Reintentar estudio</button>}
     <div className="coastal-study-key"><span><i style={{background:'#f46c55'}}/>Erosión alta</span><span><i style={{background:'#f4bd65'}}/>Erosión baja</span><span><i style={{background:'#a9bdc0'}}/>Estable</span><span><i style={{background:'#4fc4ad'}}/>Acreción</span></div>
     <details><summary>Datos y método</summary><p>Promedio en metros por año durante el periodo elegido; no es una medición de cada año.</p><p>La fecha del fondo se indica en el selector inferior.</p></details>
     <a href="https://doi.org/10.1016/j.rsma.2023.103247" target="_blank" rel="noreferrer">Fuente del estudio · DOI</a>
    </>:<>
     {historicalEvidence}
     <details><summary>Documentos y alcance del archivo</summary><p>Fotos y planos por fecha y localidad; cobertura parcial. El mapa de orientación es actual.</p>
     <ul className="coastal-historical-sources">
      <li><a href="https://archivogeneral.yucatan.gob.mx/files-content/general/catalogos/06dc74d77c0ace4126a6260dbea6492d.pdf" target="_blank" rel="noreferrer">Catastro 1903–1985 · AGEY</a><small>Inventario; originales pendientes de consulta.</small></li>
      <li><a href="https://archivogeneral.yucatan.gob.mx/boletines/plano-del-puerto-de-progreso-datos-de-su-situacion-geografica-13-de-mayo-de-1951" target="_blank" rel="noreferrer">Plano de Progreso · 13 mayo 1951</a><small>Documento local sin georreferenciar.</small></li>
      <li><a href="https://sic.cultura.gob.mx/ficha.php?disciplina=&table=fototeca&table_id=3" target="_blank" rel="noreferrer">Fototeca Pedro Guerra · UADY</a><small>Fotos y fechas por verificar.</small></li>
      <li><a href="https://fjsantamaria.ujat.mx/Publication/Details/1336" target="_blank" rel="noreferrer">Almanaque de Espinosa · 1958 · UJAT</a><small>Ficha localizada; contenido pendiente.</small></li>
      <li><a href="https://www.inegi.org.mx/app/geo2/siiv/" target="_blank" rel="noreferrer">Índices de vuelos · INEGI</a><small>23 registros de 1971–1980, Chelem–Progreso; imágenes pendientes.</small></li>
     </ul>
     <details><summary>Cómo se incorporará la evidencia</summary><p>La comparación requiere fecha, ubicación, escala y error de alineación comprobados. Una foto aislada no permite medir el cambio.</p></details>
     </details>
    </>)}
   </div>
  </section>)}
  </div>
  {!minimized&&expanded&&<button type="button" className="coastal-period-resize" aria-label="Ajustar tamaño del panel de estudios" title="Arrastra para ajustar el tamaño · o usa las flechas del teclado" onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={()=>{resizing.current=null;}} onPointerCancel={()=>{resizing.current=null;}} onLostPointerCapture={()=>{resizing.current=null;}} onKeyDown={keyboardResize}><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 13 13 3M8 13l5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>}
 </aside>;
}
