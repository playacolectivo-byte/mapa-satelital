'use client';
import {historicalRates,historicalRetreat} from '@/lib/historical-retreat';
const n=(value:number)=>value.toLocaleString('es-MX',{maximumFractionDigits:1});
export function HistoricalErosionSummary({year,onYear}:{year:number;onYear:(year:number)=>void}){
 return <section className="historical-estimates" aria-label="Estimaciones históricas de erosión">
  <strong>Cambio histórico · 1948–1978</strong>
  <p>Estimación asistida por ChatGPT · Meyer-Arendt (1993).</p>
  {historicalRates.map(rate=>{const selected=historicalRetreat(rate,year),full=historicalRetreat(rate,rate.last)!;return <article key={rate.id}>
   <strong>{rate.label}</strong>
   <b>≈ {n(selected&&selected.years>0?selected.minimum:full.minimum)}{(selected&&selected.years>0?selected.maximum:full.maximum)!==(selected&&selected.years>0?selected.minimum:full.minimum)?'–'+n(selected&&selected.years>0?selected.maximum:full.maximum):''} m hacia tierra · 1948 → {selected&&selected.years>0?year:1978}</b>
   <small>{rate.allowLinearScenario===false?'Equivalente del periodo completo; no se distribuye por años.':'Escenario de tasa constante: '+n(rate.minimumRate)+(rate.maximumRate!==rate.minimumRate?'–'+n(rate.maximumRate):'')+' m/año.'} No es una medición de {year}.</small>
   <details><summary>Referencia del intervalo completo</summary><small>1948–1978: equivalente ≈ {n(full.minimum)}{full.maximum!==full.minimum?'–'+n(full.maximum):''} m. El promedio no determina cuándo sucedió cada cambio.{rate.structuralBreakYear?' El puerto abrió en '+rate.structuralBreakYear+'; repartir esta tasa uniformemente antes de esa obra no está respaldado.':''}</small></details>
  </article>;})}
  <details><summary>Datos y método</summary><p>Tasa media × años. Rango regional, sin error histórico recuperado ni medición por parcela.</p></details>
  {(year<1948||year>1978)&&<small>El año {year} queda fuera del intervalo de estas tasas. Se conserva la referencia 1948–1978 sin extrapolar.</small>}
  <button onClick={()=>onYear(1978)} disabled={year===1978}>Ver cierre de 1978</button>{' '}
  <a href={historicalRates[0].sourceUrl} target="_blank" rel="noreferrer">Fuente original · pp. 105–106</a>
 </section>;
}
