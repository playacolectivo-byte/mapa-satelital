'use client';

import { ExplanationPoints } from './explanation-points';
import { CoastalCsvDownload } from './coastal-csv-download';
import { evolutionComparison, evolutionMessage, EVOLUTION_COLORS, UNAVAILABLE_TEXT, type EvolutionIndex } from '@/lib/coastal-evolution';
import { shortLittoralDate } from '@/lib/littoral-series';
import { publishedValues, researchSeries, S34_URL, type ErosionFeature } from '@/lib/problems';
import { historicalContextMessage } from '@/lib/historical-context';

export function CoastalEvolutionDetails({ index, year, id, published, cutId }: { index: EvolutionIndex; year: number; id: string; published?: ErosionFeature | null; cutId?: string | null }) {
  const comparison = evolutionComparison(index, id, year, cutId);
  const missing = comparison.status === 'no_reference' || comparison.status === 'no_observation';
  const historical=published&&year>=1993&&year<=2011&&comparison.status==='no_observation'?historicalContextMessage(published,year):null;
  return <article className="compact-selection" aria-live="polite" data-explanation="evolution" data-evolution-bar={id} data-evolution-year={year} data-evolution-status={comparison.status} data-evolution-change={comparison.changeM ?? ''}>
    <h2>{year<1993?'Sin comparación antes de 1993':comparison.status==='no_reference'?'Sin base de 1993':missing?UNAVAILABLE_TEXT:comparison.status==='baseline'?'Base fija 1993 · '+(comparison.baselineEstimate?'estimada (≈)':'observada'):`${comparison.status==='estimated'?'Estimado':'Observado'} desde 1993 · ≈ ${Math.abs(comparison.changeM!).toLocaleString('es-MX')} m ${comparison.changeM!<0?'hacia tierra':comparison.changeM!>0?'hacia el mar':'de cambio redondeado'}`}</h2>
    {(comparison.status==='estimated'||comparison.baselineEstimate)&&<small>Estimación del proyecto · asistida por ChatGPT</small>}
    <ExplanationPoints points={[{ label: '', text: evolutionMessage(comparison) }]} />
    {historical&&<p>Contexto complementario, no cambio desde 1993: {historical}</p>}
    {historical&&<a className="compact-link" href={S34_URL} target="_blank" rel="noreferrer">Fuente · Alec y colaboradores</a>}
    <details className="compact-details"><summary>Fechas, datos y fuentes</summary>
      <p>Barra {id}. Referencia fija: 1993. La base y las comparaciones derivadas se calculan en el proyecto con asistencia de ChatGPT; no son resultados anuales originales del artículo de Alec y colaboradores. Si la base es modelada, toda la comparación es estimada, incluso con un extremo posterior observado. Sin corrección de marea y oleaje; no confirma pérdida de arena.</p>
      <p>Una barra medida más corta que una estimada de otro año no prueba recuperación. Compara el mismo sitio, fechas y método; los colores muestran el movimiento aparente del agua, no la salud de la playa.</p>
      {comparison.beforeCut && <a className="compact-link" href={comparison.beforeCut.source_url} target="_blank" rel="noreferrer">Referencia · {comparison.beforeCut.origin==='sentinel'?'Sentinel':'Landsat'} · {shortLittoralDate(comparison.beforeCut.datetime)} · {comparison.beforeCut.product?.id}</a>}
      {comparison.baselineEstimate&&<><p>Base 1993 estimada (≈) · tendencia {comparison.baselineEstimate.model.series} de {comparison.baselineEstimate.period}: {comparison.baselineEstimate.model.rate_m_year} m/año. Ancla real: {shortLittoralDate(comparison.baselineEstimate.anchorCut.datetime)} · {comparison.baselineEstimate.anchorCut.product?.id}. Evaluación matemática al 1 de julio de 1993; no existe aquí una observación de 1993 para este eje. No se calcula antes del ancla ni fuera del periodo publicado.</p><a className="compact-link" href={comparison.baselineEstimate.sourceUrl} target="_blank" rel="noreferrer">Fuente de la tendencia para la base de 1993</a><a className="compact-link" href={comparison.baselineEstimate.anchorCut.source_url} target="_blank" rel="noreferrer">Captura real que ancla la base estimada</a></>}
      {comparison.estimate&&<><p>Extremo posterior estimado según el estudio · {comparison.estimate.period} · {comparison.estimate.model.rate_m_year} m/año. Ancla: {shortLittoralDate(comparison.estimate.anchorCut.datetime)} · {comparison.estimate.anchorCut.product?.id}. Evaluación matemática al 1 de julio de {year}; no es una captura. Métodos combinados pendientes de homologación.</p><a className="compact-link" href={comparison.estimate.sourceUrl} target="_blank" rel="noreferrer">Fuente de la tendencia · Alec y colaboradores</a><a className="compact-link" href={comparison.estimate.anchorCut.source_url} target="_blank" rel="noreferrer">Fuente de la posición que ancla la estimación</a></>}
      {comparison.afterCut && comparison.after && <a className="compact-link" href={comparison.afterCut.source_url} target="_blank" rel="noreferrer">Posición satelital procesada · {comparison.afterCut.origin === 'sentinel' ? 'Sentinel-2' : 'Landsat'} · {shortLittoralDate(comparison.afterCut.datetime)} · {comparison.afterCut.product?.id}</a>}
      {comparison.afterCut && comparison.after && <p>Algoritmo: {comparison.afterCut.method_id??'no registrado'}. Procesamiento del proyecto; el producto satelital original conserva su procedencia. {comparison.afterCut.quality_note}</p>}
      {published && <details className="compact-details"><summary>Investigación publicada · Alec y colaboradores</summary><p>Tasas originales publicadas y sus periodos; no son posiciones anuales ni resultados generados por ChatGPT:</p><table className="evolution-source-table"><thead><tr><th>Periodo</th><th>m/año</th></tr></thead><tbody>{[...researchSeries].reverse().map((series) => { const value = publishedValues(published, series.id); return <tr key={series.id}><td>{series.period}</td><td>{value ? value.rate.toLocaleString('es-MX', { maximumFractionDigits: 2 }) : 'Sin dato'}</td></tr>; })}</tbody></table><p>Las posiciones principales se obtienen de Landsat y Sentinel. Estos promedios publicados permiten contrastar el contexto histórico.</p><a className="compact-link" href={S34_URL} target="_blank" rel="noreferrer">Estudio original de Alec y colaboradores</a></details>}
      <CoastalCsvDownload path="/data/littoral/changes-from-1993.csv.gz" filename="changes-from-1993.csv" label="Descargar comparación desde 1993 · tipos y fechas separados" />
      <a className="compact-link" href="/data/littoral/coastal-evolution.json" target="_blank" rel="noreferrer">Serie, procedencia y vacíos</a>
      <a className="compact-link" href="/data/littoral/fixed-1993-method.md" target="_blank" rel="noreferrer">Procedimiento y límites</a>
    </details>
  </article>;
}

export function CoastalEvolutionLegend({ index, year, status, historicalContext=false,trendStatus='ready' }: { index: EvolutionIndex | null; year: number; status: 'loading' | 'ready' | 'error'; historicalContext?:boolean;trendStatus?:'loading'|'ready'|'error' }) {
  return <div className="research-map-legend evolution-legend" aria-label="Leyenda de cambio con base fija 1993" data-evolution-legend-year={year}>
    <p>Cambio desde 1993 · {year}</p>
    <small>{status === 'loading' ? 'Cargando posiciones…' : status === 'error' ? 'No se pudieron cargar los datos' : year<1993?'Sin comparación: base de 1993 posterior al año elegido':!index?.baselineValues.size?'Sin bases de 1993 compatibles':'Base fija 1993 → año elegido'}</small>
    <div className="erosion-legend">
      <span><i style={{ background: EVOLUTION_COLORS[2].retreat }} />Hacia tierra</span>
      <span><i style={{ background: EVOLUTION_COLORS[2].advance }} />Hacia el mar</span>
      <span><i style={{ background: '#8b9690' }} />Base 1993 / ≈0 m</span>
    </div>
    <small>Base de 1993 estimada por el proyecto · asistida por ChatGPT.</small>
    <details className="coastal-legend-method"><summary>Ver método y alcance</summary>
    <small>Estimación del proyecto · asistida por ChatGPT</small>
    <small>Tasas de la base: investigación publicada · Alec y colaboradores · L5 1986–2011.</small>
    <small>Continua: ambos extremos observados · discontinua: base o extremo estimado.</small>
    {index&&<small>Base 1993: {index.references.size.toLocaleString('es-MX')} observadas · {index.baselineEstimates.size.toLocaleString('es-MX')} estimadas (≈).</small>}
    <small>Gris: inicio, cambio redondeado o sin comparación.</small>
    <small>Sin corrección de marea y oleaje · no confirma deterioro.</small>
    {trendStatus!=='ready'&&<small role="status">{trendStatus==='loading'?'Cargando estimaciones…':'No se pudieron cargar las estimaciones; se conservan las mediciones.'}</small>}
    {historicalContext&&<small className="published-context-key"><i aria-hidden="true"/> Punteado: investigación publicada · Alec y colaboradores · 1986–2011</small>}
    </details>
  </div>;
}
