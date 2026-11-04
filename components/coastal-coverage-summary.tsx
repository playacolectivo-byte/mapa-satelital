'use client';
import type {MunicipalCoverage} from '@/lib/coastal-coverage';

export function CoastalCoverageSummary({rows,year,visible,onVisible}:{rows:MunicipalCoverage[];year:number;visible:boolean;onVisible:(visible:boolean)=>void}){
 const sum=(key:'total'|'processed'|'estimated'|'unresolved')=>rows.reduce((total,row)=>total+row[key],0).toLocaleString('es-MX');
 return <section className="coastal-coverage-summary" aria-label="Cobertura de la investigación por municipio">
  <label className="coastal-check coastal-coverage-toggle"><input type="checkbox" aria-label="Ver estado de investigación en toda la costa" checked={visible} onChange={event=>onVisible(event.target.checked)}/><span>Cobertura de toda la costa</span></label>
  <details>
   <summary>Ver cobertura por municipio</summary>
   <div className="coastal-coverage-detail">
    <p>{sum('total')} perfiles regionales evaluados en {year}. Sin cifra no significa cero erosión.</p>
    <table><thead><tr><th>Municipio</th><th title="Posiciones procesadas; no validación de campo">Proc.</th><th>Est.</th><th>Sin cifra</th></tr></thead><tbody>{rows.map(row=><tr key={row.municipality}><td>{row.municipality}</td><td>{row.processed}</td><td>{row.estimated}</td><td>{row.unresolved}</td></tr>)}</tbody></table>
    <p>Gris: todavía sin comparación cuantificable. El inventario regional y los ejes antiguos tienen distinta distribución; no se suman como longitud de costa validada.</p>
    <p>Los perfiles se sitúan sobre playas. La costa portuaria, vegetada o de otro tipo conserva una referencia cartográfica separada y requiere su propio método. Las franjas ubican la evaluación; su anchura no representa metros perdidos.</p>
    <div className="coastal-coverage-links"><a href="/data/shorelines/series-2015/method.md" target="_blank" rel="noreferrer">Método y límites</a><a href="/data/shorelines/series-2015/calculations.csv.gz" download>Descargar cálculos</a></div>
   </div>
  </details>
 </section>;
}
