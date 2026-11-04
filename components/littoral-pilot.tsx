'use client';

import { useEffect, useRef } from 'react';
import { TimelinePill, type ImageInfo } from './timeline-pill';
import { ExplanationPoints } from './explanation-points';
import { littoralMeasurement, littoralPoints, littoralYearBounds, shortLittoralDate, WATER_CHANGE_SCALE, WATER_CHANGE_NEUTRAL, type LittoralSeries, type LittoralCut } from '@/lib/littoral-series';
import type { ImageSource } from './imagery-choice';
import { barFootprint, type TransectIndex } from '@/lib/transect-pairs';

export function LittoralTimeline({ series, cut, year, status, onYearChange, source, onSource, onInfo, onRetry }: { series: LittoralSeries; cut: LittoralCut; year: number; status: 'loading' | 'ready' | 'error'; onYearChange: (year: number) => void; source: ImageSource; onSource: (source: ImageSource) => void; onInfo: () => void; onRetry: () => void }) {
  const { firstYear, lastYear } = littoralYearBounds(series);
  return <div className="littoral-timeline">
    <output className="littoral-current-cut" aria-live="polite" data-cut-id={cut.id}>
      {cut.origin === 'alec' ? 'Alec · ' + cut.period_label + ' · m/año' : cut.origin === 'sentinel' ? 'Sentinel · ' + shortLittoralDate(cut.datetime) + ' · m' : cut.period_label + ' · sin mediciones'}
    </output>
    <TimelinePill source={source} year={String(year)} value={year - firstYear} count={lastYear - firstYear + 1} rangeLabel="Corte temporal de mediciones" infoLabel="Información del corte de medición" label={'Año ' + year + '. Dato: ' + cut.period_label + '. ' + (cut.origin === 'alec' ? 'Alec, promedio del intervalo completo' : cut.origin === 'sentinel' ? 'Sentinel, posición del agua' : 'Sin mediciones')} status={status} onChange={(value) => onYearChange(firstYear + value)} onSource={onSource} onInfo={onInfo} onRetry={onRetry} />
  </div>;
}

export function LittoralPilotPanel({ series, cut, barIndex, selectedId, onSelect, onCut, status, onRetry }: { series: LittoralSeries | null; cut: LittoralCut | null; barIndex: TransectIndex | null; selectedId: string | null; onSelect: (id: string) => void; onCut: (id: string) => void; status: 'loading' | 'ready' | 'error'; onRetry: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const bar = barIndex?.byId.get(selectedId ?? '') ?? barIndex?.features[0];
  const footprint = bar && barIndex ? barFootprint(bar, barIndex) : null;
  useEffect(() => { if (bar) root.current?.closest('.floating-panel-body')?.scrollTo({ top: 0 }); }, [bar?.properties.idPol_Tran]);
  if (status === 'error') return <div role="alert"><p>No se pudo cargar la serie del piloto.</p><button className="compact-link" onClick={onRetry}>Reintentar datos</button></div>;
  if (!series || !cut) return <output>Cargando mediciones del piloto…</output>;
  if (!bar || !barIndex || !footprint) return <output>Sin barra disponible para consultar.</output>;
  const method = series.methods.find((entry) => entry.id === cut.method_id);
  const selected = littoralMeasurement(cut, footprint.id);
  const previous = barIndex.previous.get(footprint.id), next = barIndex.next.get(footprint.id);
  return <div ref={root} className="littoral-panel" data-selected-transect={footprint.id} data-selected-cut={cut.id}>
    <div className="transect-span-heading"><p className="littoral-pilot-name">Barra · {footprint.id}</p><div className="transect-span-navigation">
      <button type="button" aria-label="Barra anterior" disabled={!previous} onClick={() => previous && onSelect(previous.properties.idPol_Tran)}>←</button>
      <button type="button" aria-label="Barra siguiente" disabled={!next} onClick={() => next && onSelect(next.properties.idPol_Tran)}>→</button>
    </div></div>
    <p className="littoral-panel-hint">Toca los puntos o sus rótulos en el mapa para entender cada medida.</p>
    <details className="compact-details" open><summary>Elegir barra y fecha</summary>
    <label className="littoral-control">Corte de medición<select aria-label="Corte de medición" value={cut.id} onChange={(event) => onCut(event.target.value)}>{!series.cuts.some((entry) => entry.id === cut.id) && <option value={cut.id}>{cut.period_label} · sin mediciones</option>}{series.cuts.map((entry) => <option key={entry.id} value={entry.id}>{entry.origin === 'alec' ? 'Alec · ' : entry.origin === 'sentinel' ? 'Sentinel · ' : ''}{entry.period_label}</option>)}</select></label>
    <label className="littoral-control">Barra del piloto<select aria-label="Barra del piloto" value={footprint.id} onChange={(event) => onSelect(event.target.value)}>{barIndex.features.map((entry) => <option key={entry.properties.idPol_Tran} value={entry.properties.idPol_Tran}>{entry.properties.idPol_Tran}</option>)}</select></label>
    </details>
    <details className="compact-details"><summary>Datos científicos y fuentes</summary>
    <div aria-live="polite" aria-atomic="true"><ExplanationPoints points={littoralPoints(cut, footprint.id)} /></div>
    <p className="littoral-value" data-bar-id={footprint.id} data-measurement-value={selected?.value ?? 'no-data'} data-measurement-unit={cut.unit ?? 'none'}>{selected?.value === null || !selected ? 'Sin dato' : selected.value.toLocaleString('es-MX', { maximumFractionDigits: cut.origin === 'alec' ? 2 : 0 }) + (cut.origin === 'alec' ? ' m/año' : ' m')}<span>{cut.origin === 'alec' ? 'Tasa del intervalo' : cut.origin === 'sentinel' ? 'Agua desde el punto 0' : ''}</span></p>
    <a className="compact-link" href={cut.source_url} target="_blank" rel="noreferrer">{cut.origin === 'alec' ? 'Estudio de Alec y colaboradores' : 'Fuente del corte'}</a>
    {cut.product && <a className="compact-link" href={cut.product.metadata_url} target="_blank" rel="noreferrer">Producto: {cut.product.id}</a>}
    <details className="compact-details"><summary>Método y comparabilidad</summary><p>El frente de referencia se reparte a mitad de distancia hacia las barras vecinas de esta vista y se mide en WGS84. Es una convención gráfica: la medición científica se hace sobre el eje y no confirma que todo ese frente tenga el mismo cambio. En los extremos se detiene en la última barra recibida. El largo de la línea es otra distancia y no mide playa perdida.</p><p>El origen técnico se conserva en el extremo sur del eje para reproducir las distancias. En el mapa, los extremos de la barra están en las posiciones guardadas del agua: antes y después. La foto de fondo tiene su propia fecha.</p><p>{method?.name}. {method?.description}</p><p>{Array.isArray(method?.limitations) ? method.limitations.join(' ') : method?.limitations}</p><p>Los periodos históricos se superponen. No sumamos sus tasas ni asignamos una captura al cierre de 2021. La fotografía de fondo conserva su propia fecha.</p></details>
    <a className="compact-link" href="/data/littoral/pilot-series.json" target="_blank" rel="noreferrer">Descargar serie y procedencia</a>
    <a className="compact-link" href="/data/littoral/measurements.csv" download>Descargar mediciones CSV</a>
    <a className="compact-link" href="/data/littoral/method.md" target="_blank" rel="noreferrer">Procedimiento y límites</a>
    </details>
  </div>;
}

export function LittoralLegend({ cut, count }: { cut: LittoralCut; count: number }) {
  return <div className="research-map-legend littoral-legend" aria-label="Leyenda del piloto">
    <p>{cut.origin === 'alec' ? 'Cambio litoral histórico · Alec et al.' : cut.origin === 'sentinel' ? 'Cambio litoral reciente · Sentinel-2' : 'Sin mediciones para este intervalo'}</p>
    <small>{cut.origin === 'sentinel' ? (cut.baseline_date && cut.baseline_date !== cut.datetime ? shortLittoralDate(cut.baseline_date) + ' → ' : '') + shortLittoralDate(cut.datetime) : cut.period_label}</small>
    <div className="erosion-legend">{cut.origin === 'alec' ? <><span><i style={{ background: '#f46c55' }} />Erosión alta</span><span><i style={{ background: '#f4bd65' }} />Erosión baja</span><span><i style={{ background: '#a9bdc0' }} />Estable</span><span><i style={{ background: '#4fc4ad' }} />Acumulación</span></> : cut.origin === 'sentinel' ? <><span><i style={{ background: `linear-gradient(to right, ${WATER_CHANGE_SCALE.map((step) => step.retreat).join(', ')})`, width: 32, height: 5 }} />Hacia tierra</span><span><i style={{ background: WATER_CHANGE_NEUTRAL }} />Base / ≈0 m</span><span><i style={{ background: `linear-gradient(to right, ${WATER_CHANGE_SCALE.map((step) => step.advance).join(', ')})`, width: 32, height: 5 }} />Hacia el mar</span></> : null}<span><i style={{ background: '#9ba7a8' }} />Sin dato</span></div>
    {cut.origin === 'sentinel' && <small>Más intensidad = más metros · escala fija: 5–20 m o más.</small>}
    <small>{cut.origin === 'sentinel' ? 'Antes → después · largo = metros de cambio · preliminar' : cut.origin === 'alec' ? 'Largo fijo · color = promedio del periodo · m/año' : 'Sin medición no significa sin erosión'}</small>
    <small>{count} sitios · toca una cifra para ver el dato</small>
  </div>;
}

export function LittoralBackgroundDate({ source, info, year, status, backgroundLabel, unavailable=false, unavailableNote, note,compact=false }: { source: ImageSource; info: ImageInfo | null; year: number; status: 'loading' | 'ready' | 'error'; backgroundLabel?:string; unavailable?:boolean; unavailableNote?:string; note?:string;compact?:boolean }) {
  const captureYear = info?.captureDate?.slice(0, 4);
  if(compact)return <div className="littoral-background-date is-compact" title={note} data-background-year={year} data-background-capture={info?.captureDate??''} data-background-status={status}>
    <span>{status==='loading'?'Cargando':status==='error'?'Revisar imagen':'Referencia'} · {(backgroundLabel??source).replace(' · referencia visible','')}</span>
    <strong>{info?.capture??'Fecha en consulta'}</strong>
  </div>;
  return <div className="littoral-background-date" data-background-year={year} data-background-capture={info?.captureDate??''} data-background-status={status} data-background-availability={unavailable?(info?'earlier-reference':'missing'):'available'}><span>{status==='loading'?(unavailable?'Consultando fecha':'Actualizando fondo'):'Fondo de referencia'} · {backgroundLabel??(source === 'detail' ? 'Esri' : source === 'archive' ? 'Histórico' : 'Sentinel')}</span><strong>{info?.capture??(status==='loading'?'Preparando imagen…':null)??(unavailable?source==='detail'?'HD pendiente · '+year:'Sin fotografía verificada de '+year:'Fecha de captura en consulta')}</strong><small>{unavailable?unavailableNote??(info?'Falta la foto de '+year+' · referencia anterior de '+captureYear:source==='sentinel'&&year<2015?'El archivo Sentinel comienza en 2015':'Descarga pendiente · no se usa una foto posterior'):status === 'loading' ? 'Se conserva el fondo de referencia hasta que la selección esté lista. '+(info?.captureDate?'Imagen visible: '+info.captureDate+'. ':'') : status === 'error' ? 'Imagen incompleta · consulta o reintenta' : note??(captureYear && Number(captureYear) !== year ? 'Año elegido: ' + year + ' · imagen disponible de ' + captureYear : 'Fecha propia, distinta del corte de medición')}</small></div>;
}
