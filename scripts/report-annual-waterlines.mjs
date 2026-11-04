import { readFile, readdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createEvolutionIndex, evolutionComparison, validateEvolutionCatalogue } from '../lib/coastal-evolution.ts';

const root=new URL('../',import.meta.url);
const json=async(path)=>JSON.parse(await readFile(new URL(path,root)));
const scope=await json('scientific/annual-waterlines/scope.json');
const ids=scope.transects.features.map(f=>f.properties.idPol_Tran);
const review=await json('scientific/annual-waterlines/acceptance-review.json');
const execution=await json('scientific/annual-waterlines/execution-status.json');
const previous=await json('scientific/annual-waterlines/previous-delivery-reference.json');
const previousKeys=new Set(previous.products.flatMap(p=>p.transect_ids.map(id=>p.product_id+'|'+id)));
const previousProducts=new Set(previous.products.map(p=>p.product_id));
const catalogue=validateEvolutionCatalogue(await json('public/data/littoral/coastal-evolution.json'));
const index=createEvolutionIndex(catalogue);
const recordRoot=new URL('scientific/annual-waterlines/records/',root);
const records=await Promise.all((await readdir(recordRoot,{recursive:true})).filter(n=>n.endsWith('.json')).map(async n=>JSON.parse(await readFile(new URL(n,recordRoot)))));
const accepted=records.filter(r=>review.accepted_observation_ids.includes(r.id));
let cachedExtension=null;
try {
  const extensionReview=await json('scientific/coverage-extension/acceptance-review.json');
  const verification=await json('scientific/coverage-extension/verification.json');
  const previousExtension=await json('scientific/coverage-extension/previous-delivery.json');
  const beforeKeys=new Set(previousExtension.product_axis_keys);
  const currentKeys=new Set(catalogue.observations.flatMap(c=>c.measurements.filter(m=>m.point).map(m=>c.product.id+'|'+m.transect_id)));
  cachedExtension={scope_id:verification.scope_id??'chelem-received-pilot-window-all-original-axes',
    source_axes:verification.source_axes,processed_products:verification.products,
    accepted_expanded_records:extensionReview.accepted_observation_ids.length,
    original_pilot_results_reproduced:verification.original_pilot_results_reproduced,
    native_crops_verified:verification.native_crops_verified,
    new_unique_product_axis_positions:[...currentKeys].filter(k=>!beforeKeys.has(k)).length,
    compared_with_commit:previousExtension.source_commit,
    network_requests:verification.network_requests,mask_and_threshold_changes:extensionReview.mask_and_threshold_changes};
} catch(error){if(error.code!=='ENOENT')throw error;}
const rawRoot=new URL('scientific/annual-waterlines/raw/',root);
const screened=(await readdir(rawRoot,{recursive:true})).filter(n=>n.endsWith('/screen-quality.json'));
const screenedRecords=await Promise.all(screened.map(async name=>JSON.parse(await readFile(new URL(name,rawRoot)))));
const batches=await Promise.all(['landsat-1986-1994','landsat-1995-2003','landsat-2004-2012','landsat-2013-2020','sentinel-2018-2021','sentinel-2022-2026'].map(async n=>{try{return {name:n,...await json('scientific/annual-waterlines/batch-'+n+'.json')};}catch{return {name:n,finished_at:null};}}));
const inventories=[];
for(const filename of ['landsat-1986-2020-12-31-183200.json.gz','sentinel-2015-2026-10-27-183233.json.gz']){
  const data=JSON.parse(gunzipSync(await readFile(new URL('scientific/annual-waterlines/inventories/'+filename,root))));
  const sensor=filename.startsWith('landsat')?'landsat':'sentinel';
  const filtered=data.features.filter(i=>sensor==='landsat'?i.id.endsWith('_T1'):i.id.split('_')[1]==='T16QBJ' && /_R040_/.test(i.properties['s2:product_uri']??''));
  inventories.push({sensor,filename,complete:data.complete,catalogued_products:data.features.length,filtered_products:filtered.length,
    first_filtered_capture:filtered.map(i=>i.properties.datetime).sort()[0],last_filtered_capture:filtered.map(i=>i.properties.datetime).sort().at(-1)});
}
const coverage=[];
for(let year=1986;year<=2026;year++){
  const counts={available:0,baseline:0,no_reference:0,no_observation:0};
  const products=new Set();const dates=new Set();
  for(const id of ids){const c=evolutionComparison(index,id,year);counts[c.status]++;if(c.after?.point){products.add(c.afterCut.product.id);dates.add(c.afterCut.datetime);}}
  const processed=records.filter(r=>r.datetime.startsWith(String(year)));
  coverage.push({year,...counts,actual_products:products.size,new_products_screened:screenedRecords.filter(r=>r.datetime.startsWith(String(year))).length,
    new_products_fully_processed:processed.length,
    gap_note:counts.available+counts.baseline+counts.no_reference>0 ? null : processed.some(r=>r.quality_diagnostics.valid_transects>0) ? 'Candidatos con posiciones aún no aceptados; falta control adicional.' : processed.length ? 'Los candidatos procesados no pasaron los filtros. No se agotó el archivo; faltan alternativas y revisión metodológica.' : 'Año sin procesamiento completo incorporado en esta ampliación; descargas interrumpidas por la política de red.',
    earliest_measurement_date:[...dates].sort()[0]??null,latest_measurement_date:[...dates].sort().at(-1)??null});
}
const uniquePositions=new Set(catalogue.observations.flatMap(c=>c.measurements.filter(m=>m.point).map(m=>c.product.id+'|'+m.transect_id)));
const csv=gunzipSync(await readFile(new URL('public/data/littoral/changes-from-1986.csv.gz',root)));
const summary={generated_at:new Date().toISOString(),scope_id:scope.id,analysis_bbox:scope.analysis_bbox,original_axes_in_processing_window:ids.length,
  original_regional_axes:9645,all_selected_batches_finished:batches.every(b=>!!b.finished_at),inventories,
  locally_quality_screened_products:screened.length,fully_processed_new_products:records.length,
  newly_accepted_observations:accepted.length,new_usable_positions:accepted.reduce((n,r)=>n+r.quality_diagnostics.valid_transects,0),
  newly_introduced_product_ids:new Set(accepted.map(r=>r.product.id).filter(id=>!previousProducts.has(id))).size,
  new_zero_position_candidates:records.filter(r=>!r.quality_diagnostics.valid_transects).length,
  nonzero_new_candidates_not_accepted:records.filter(r=>r.quality_diagnostics.valid_transects && !review.accepted_observation_ids.includes(r.id)).map(r=>({id:r.id,positions:r.quality_diagnostics.valid_transects})),
  total_delivered_observations:catalogue.observations.length,total_unique_delivered_product_axis_positions:uniquePositions.size,
  cached_window_extension:cachedExtension,
  newly_added_unique_product_axis_positions:[...uniquePositions].filter(key=>!previousKeys.has(key)).length,
  previous_delivery_reference_commit:previous.source_commit,
  annual_csv_rows:csv.toString('utf8').trim().split(/\r?\n/).length-1,annual_csv_uncompressed_bytes:csv.length,
  window_1986_reference_positions:ids.filter(id=>index.references.has(id)).length,
  window_years_with_observations:coverage.filter(y=>y.available+y.baseline+y.no_reference>0).map(y=>y.year),
  window_years_without_accepted_observations:coverage.filter(y=>y.available+y.baseline+y.no_reference===0).map(y=>y.year),
  primary_measurements:'Landsat C2 L2 and Sentinel-2 C1 L2A, apparent water-edge positions',
  execution_status:execution,
  alec_role:'Complementary original interval rates and unchanged spatial axes; never fabricated annual positions',
  limitations:['preliminary, not confirmed beach loss','no tide or wave correction','no independent registration or sensor homologation','variable within-year seasons and per-axis dates','partial window coverage, not every regional axis','bounded candidate selection, not an exhaustive quality review of the full archives'],coverage};
await writeFile(new URL('scientific/annual-waterlines/result-summary.json',root),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({...summary,coverage:undefined,nonzero_new_candidates_not_accepted:summary.nonzero_new_candidates_not_accepted.length}));
