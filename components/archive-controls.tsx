'use client';
import type { ArchiveKind, HistoricalEpoch, HistoricalManifest } from '@/lib/history';
const names: Record<ArchiveKind,string> = { landsat:'Satélite Landsat', inegi:'Detalle INEGI', nasa:'NASA anual', geomedian:'INEGI anual' };
export function ArchiveControls({ partial=false,kind, manifest, epoch, year, covered, status, availableKinds, excludedCount, onKind, onCoverage, onInfo, onRetry }: {
  partial?:boolean;
  kind: ArchiveKind; manifest: HistoricalManifest | null; epoch: HistoricalEpoch | null; year: number; covered: boolean;
  status:'loading'|'ready'|'error'; availableKinds:ArchiveKind[]; excludedCount:number;
  onKind:(kind:ArchiveKind)=>void; onCoverage:()=>void; onInfo:()=>void; onRetry:()=>void;
}) {
  return <section className="archive-controls" aria-label="Imágenes del año elegido" data-archive-kind={kind} data-archive-date={epoch?.id??''} data-archive-year={year}>
    {!!availableKinds.length && <fieldset aria-label="Fuentes disponibles">
      {availableKinds.map(source=><button key={source} aria-pressed={kind===source} onClick={()=>onKind(source)}>{names[source]}</button>)}
    </fieldset>}
    {epoch ? <>
      <div className="archive-date-choice"><span>{epoch.label}</span><button onClick={onInfo} aria-label="Información y fuente del mapa anual">Fuente</button><button onClick={onCoverage}>{partial?'Ver zona disponible':'Ver toda la costa'}</button></div>
      <small>{partial?'Cobertura parcial de '+year+' · sólo se muestran las hojas recibidas.':'Mapa continuo de '+year+' · Celestún–El Cuyo.'}</small>
      {kind==='geomedian'&&<small>33 años publicados:1993–2025. Antes de1993, sin proveedor anual completo verificado.</small>}
      {!covered && <div className="archive-coverage-note" role="status"><span>Fuera de la imagen recibida</span><button onClick={onCoverage}>Ver cobertura</button></div>}
    </> : <div role="status">
      <span>{status==='loading'?'Comprobando cobertura del año…':'No hay imagen recibida de '+year+' en esta fuente.'}</span>
      {status!=='loading'&&<small>{excludedCount?'Los recortes parciales de este año quedaron fuera de las opciones. ':''}No se repite una imagen de otro año.</small>}
      {status==='error'&&<button onClick={onRetry}>Reintentar consulta</button>}
    </div>}
  </section>;
}
