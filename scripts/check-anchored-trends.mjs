import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {gunzipSync} from 'node:zlib';
import {createEvolutionIndex,evolutionComparison,evolutionMapData,evolutionBarLabels} from '../lib/coastal-evolution.ts';
import {validateAlecTrends} from '../lib/alec-trend.ts';
import {mergePublishedTransects,publishedValues} from '../lib/problems.ts';
import {batchTransects} from '../lib/map-display.ts';
const root=new URL('../',import.meta.url),bytes=p=>readFile(new URL(p,root)),json=async p=>JSON.parse(await bytes(p));
const hash=b=>createHash('sha256').update(b).digest('hex');
const catalogue=await json('public/data/littoral/coastal-evolution.json'),snapshot=JSON.stringify(catalogue);
assert.equal(hash(await bytes('public/data/littoral/coastal-evolution.json')),'67cb0b1be1004defbe877b022f6a899e488d8f9315e3ca7c3eab74bbb46fbf52');
const models=validateAlecTrends(await json('public/data/littoral/alec-trend-models.json'));
const originals=await Promise.all(['l5','l8','s2'].map(s=>json(`public/data/problems/s34-${s}.geojson`)));
const inventory=mergePublishedTransects(originals),byId=new Map(inventory.features.map(f=>[f.properties.idPol_Tran,f]));
for(const [p,sha] of Object.entries(models.input_sha256))assert.equal(hash(await bytes(p)),sha);
const index=createEvolutionIndex(catalogue,{referencePolicy:'earliest',trends:models});
const legacy=createEvolutionIndex(catalogue);
for(const[id,reference]of legacy.references){assert.equal(index.references.get(id).cut.id,reference.cut.id,'Every previously accepted 1986 reference is preserved');assert.deepEqual(index.references.get(id).measurement,reference.measurement);}
const first=new Map(),lastByYear=new Map();
for(const cut of [...catalogue.observations].sort((a,b)=>a.datetime.localeCompare(b.datetime)))for(const m of cut.measurements){
 if(!m.point||m.value===null||m.quality==='no_data')continue;
 if(!first.has(m.transect_id))first.set(m.transect_id,{cut,m});
 lastByYear.set(m.transect_id+'|'+cut.datetime.slice(0,4),{cut,m});
}
assert.equal(first.size,index.references.size);
for(const [id,{cut,m}] of first){assert.equal(index.references.get(id).cut.id,cut.id);assert.deepEqual(index.references.get(id).measurement.point,m.point);}
for(const model of models.models){
 assert.equal(model.rate_m_year,publishedValues(byId.get(model.transect_id),model.series).rate,'Original published rate, not an annual reconstruction');
 const anchor=index.catalogue.observations.find(c=>c.id===model.anchor_observation_id);
 assert.ok(anchor&&index.values.get(anchor.id).get(model.transect_id)?.point,'Every model has an actual accepted anchor');
 assert.ok(model.series==='S2'?anchor.origin==='sentinel':anchor.product.id.startsWith(model.series==='L5'?'LT05':'LC08'),'The anchor sensor family matches the published period');
}
const counts=[],examples={};let estimates=0,observed=0,baseline=0,maxFrameMs=0;
for(let year=1986;year<=2026;year++){
 const tally={year,available:0,estimated:0,baseline:0,no_observation:0,no_reference:0};
 const start=performance.now(),frame=evolutionMapData(inventory,index,year);maxFrameMs=Math.max(maxFrameMs,performance.now()-start);
 for(const f of frame.features){
  const id=f.properties.idPol_Tran,c=evolutionComparison(index,id,year);tally[c.status]++;
  if(c.status==='estimated'){
   estimates++;const e=c.estimate,p=models.periods[e.model.series];assert.ok(year>=p.start&&year<=p.end);assert.equal(c.afterCut,null,'A modeled endpoint must never masquerade as a satellite capture');
   assert.ok(!lastByYear.has(id+'|'+year),'A valid observed year always wins');
   assert.ok(Date.parse(e.evaluationDate)>Date.parse(e.anchorCut.datetime));assert.ok(Date.parse(e.evaluationDate)>Date.parse(c.beforeCut.datetime));
   const anchor=index.values.get(e.anchorCut.id).get(id),dt=(Date.parse(e.evaluationDate)-Date.parse(e.anchorCut.datetime))/(365.2425*86400000);
   assert.ok(Math.abs((c.after.raw_interpolated_position_m-(anchor.raw_interpolated_position_m??anchor.value))-e.model.rate_m_year*dt)<1e-7);
   assert.deepEqual(f.geometry.coordinates,[c.before.point,c.after.point]);
   const help=evolutionBarLabels(c);assert.ok(help.every(x=>x.explanation.points.length===1));assert.match(help[0].text,/Estimado/);
   if(!examples.estimated)examples.estimated={id,year,period:e.period,change_m:c.changeM,reference:c.beforeCut.datetime};
  }else if(c.status==='available'){
   observed++;const expected=lastByYear.get(id+'|'+year);assert.equal(c.afterCut.id,expected.cut.id);assert.deepEqual(c.after.point,expected.m.point);assert.deepEqual(c.before.point,first.get(id).m.point);
   const help=evolutionBarLabels(c);assert.ok(help.every(x=>x.explanation.points.length===1));
   if(c.beforeCut.datetime.slice(0,4)!=='1986'&&!examples.later_reference)examples.later_reference={id,year,reference:c.beforeCut.datetime,observation:c.afterCut.datetime,change_m:c.changeM};
  }else if(c.status==='baseline'){baseline++;assert.deepEqual(f.geometry.coordinates,[c.before.point,c.before.point]);assert.equal(c.changeM,null);}
 }
 if(year===2012)assert.equal(tally.estimated,0,'2012 has no published interval; no invented bridge');
 if(year>2021)assert.equal(tally.estimated,0,'No extrapolation beyond the published period');
 const batches=batchTransects(frame.features);for(const f of batches.features)if(f.properties.evolution_status==='estimated')assert.ok(f.geometry.coordinates.length);
 counts.push(tally);
}
const summary=await json('scientific/coverage-extension/anchored-evolution-summary.json');assert.equal(summary.estimated_rows,estimates);assert.equal(summary.measured_rows,observed+baseline);
for(const item of summary.exports){const data=gunzipSync(await bytes('public/data/littoral/'+item.file));assert.equal(hash(data),item.uncompressed_sha256);assert.equal(data.toString().split('\r\n').length-2,item.rows);}
assert.equal(JSON.stringify(catalogue),snapshot,'Original observations remain intact');
const places=await json('public/data/coastal-places.json');assert.equal(places.places.length,17);assert.ok(places.places.every(p=>p.municipality&&p.source_url&&p.cvegeo));
const report={checked_at:new Date().toISOString(),status:'passed',reference_axes:index.references.size,compared_observed_site_years:observed,baseline_site_years:baseline,estimated_site_years:estimates,new_satellite_observations:0,max_frame_ms:Number(maxFrameMs.toFixed(2)),models:models.models.length,examples,coverage:counts,source_catalogue_sha256:hash(await bytes('public/data/littoral/coastal-evolution.json')),official_place_labels:17,road_kilometres_added:0};
await writeFile(new URL('docs/qa/anchored-trends-2026-10-27.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,coverage:undefined}));
