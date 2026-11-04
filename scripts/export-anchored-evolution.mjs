import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {stableGzip} from './stable-gzip.mjs';
import {fileURLToPath} from 'node:url';
import {createEvolutionIndex,evolutionComparison,validateEvolutionCatalogue} from '../lib/coastal-evolution.ts';
import {validateAlecTrends} from '../lib/alec-trend.ts';
const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root));
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function exportAnchoredEvolution(){
 const catalogue=validateEvolutionCatalogue(JSON.parse(await read('public/data/littoral/coastal-evolution.json')));
 const models=validateAlecTrends(JSON.parse(await read('public/data/littoral/alec-trend-models.json')));
 for(const [path,expected] of Object.entries(models.input_sha256))if(hash(await read(path))!==expected)throw new Error('Trend source changed; regenerate/review model parameters: '+path);
 const index=createEvolutionIndex(catalogue,{referencePolicy:'earliest',trends:models});
 const fields=['transect_id','selected_year','kind','reference_date','reference_product','observation_date','observation_product','change_m','unit','alec_period','alec_rate_m_year','model_anchor_date','model_anchor_product','model_evaluation_date_not_capture','source','reference_source','method','limits'];
 const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
 const measured=[],estimated=[],coverage=[];
 for(let year=1986;year<=2026;year++){
  const counts={year,available:0,baseline:0,estimated:0,unavailable:0};
  for(const id of index.references.keys()){
   const c=evolutionComparison(index,id,year);if(c.status==='no_observation'||c.status==='no_reference'){counts.unavailable++;continue;}
   counts[c.status]++;
   const e=c.estimate;
   const row=[id,year,c.status,c.beforeCut.datetime,c.beforeCut.product.id,c.afterCut?.datetime,c.afterCut?.product?.id,c.changeM,'m',e?.period,e?.model.rate_m_year,e?.anchorCut.datetime,e?.anchorCut.product.id,e?.evaluationDate,e?.sourceUrl??c.afterCut?.source_url,c.beforeCut.source_url,e?'alec-anchored-trend-v1':c.afterCut.method_id,e?'ESTIMADO, NO OBSERVADO. Solo dentro del periodo; ancla real; métodos sin homologación validada; sin corrección de marea y oleaje.':'Posición del agua preliminar; sin corrección de marea, oleaje ni validación independiente de registro.'];
   (e?estimated:measured).push(row);
  }
  coverage.push(counts);
 }
 const exports=[];
 for(const [name,rows] of [['changes-from-first-observation',measured],['alec-trend-estimates',estimated]]){
  const bytes=Buffer.from('\ufeff'+[fields,...rows].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n');
  const compressed=stableGzip(bytes);await writeFile(new URL(`public/data/littoral/${name}.csv.gz`,root),compressed);
  exports.push({file:name+'.csv.gz',rows:rows.length,uncompressed_bytes:bytes.length,uncompressed_sha256:hash(bytes),compressed_bytes:compressed.length,compressed_sha256:hash(compressed)});
 }
 const referenceYears={};for(const {cut} of index.references.values()){const y=cut.datetime.slice(0,4);referenceYears[y]=(referenceYears[y]??0)+1;}
 const summary={reference_policy:'earliest usable real observation per axis',reference_axes:index.references.size,reference_years:referenceYears,measured_rows:measured.length,estimated_rows:estimated.length,coverage,exports,new_satellite_observations:0,method_id:models.method_id,source_catalogue_sha256:hash(await read('public/data/littoral/coastal-evolution.json'))};
 await mkdir(new URL('scientific/coverage-extension/',root),{recursive:true});
 await writeFile(new URL('scientific/coverage-extension/anchored-evolution-summary.json',root),JSON.stringify(summary,null,2)+'\n');
 await writeFile(new URL('public/data/littoral/anchored-evolution-summary.json',root),JSON.stringify(summary)+'\n');
 return summary;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const d=await exportAnchoredEvolution();console.log(JSON.stringify({references:d.reference_axes,measured_rows:d.measured_rows,estimated_rows:d.estimated_rows,reference_years:d.reference_years}));}
