import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createEvolutionIndex, validateEvolutionCatalogue, evolutionComparison, evolutionMapData, evolutionBarLabels, evolutionMessage, evolutionRuler } from '../lib/coastal-evolution.ts';
import { validateAlecTrends } from '../lib/alec-trend.ts';
import { mergePublishedTransects } from '../lib/problems.ts';
const root=new URL('../',import.meta.url),bytes=p=>readFile(new URL(p,root)),json=async p=>JSON.parse(await bytes(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const catalogue=validateEvolutionCatalogue(await json('public/data/littoral/coastal-evolution.json'));
const snapshot=JSON.stringify(catalogue),trends=validateAlecTrends(await json('public/data/littoral/alec-trend-models.json'));
const inventory=mergePublishedTransects(await Promise.all(['l5','l8','s2'].map(s=>json(`public/data/problems/s34-${s}.geojson`))));
const index=createEvolutionIndex(catalogue,{referencePolicy:'1993',trends});
assert.equal(index.references.size,0,'No accepted observation is from1993');
assert.equal(index.baselineEstimates.size,4710,'Only existing models with an earlier real anchor may supply1993');
assert.equal(index.baselineValues.size,4710);
for(const[id,{measurement,estimate:e}]of index.baselineEstimates){
 assert.equal(e.model.series,'L5');assert.equal(e.period,'1986–2011');
 assert.equal(e.evaluationDate,'1993-07-01T12:00:00.000Z');assert.ok(Date.parse(e.anchorCut.datetime)<Date.parse(e.evaluationDate));
 const anchor=index.values.get(e.anchorCut.id).get(id);
 const expected=(anchor.raw_interpolated_position_m??anchor.value)+e.model.rate_m_year*(Date.parse(e.evaluationDate)-Date.parse(e.anchorCut.datetime))/(365.2425*86400000);
 assert.ok(Math.abs(measurement.raw_interpolated_position_m-expected)<1e-8);
}
for(const m of trends.models.filter(m=>m.series==='L5')){
 const anchor=index.cutsById.get(m.anchor_observation_id);
 if(Date.parse(anchor.datetime)>=Date.parse('1993-07-01T12:00:00.000Z'))assert.ok(!index.baselineValues.has(m.transect_id),'A later anchor cannot silently create a retrospective base');
}
const coverage=[],examples={};let checked=0;
for(let year=1986;year<=2026;year++){
 const counts={year,baseline:0,available:0,estimated:0,no_reference:0,no_observation:0,observed_current_endpoints:0,estimated_current_endpoints:0};
 const frame=evolutionMapData(inventory,index,year);
 for(const f of frame.features){
  const c=evolutionComparison(index,f.properties.idPol_Tran,year);counts[c.status]++;checked++;
  assert.equal(c.baselineYear,1993);
  if(year<1993){assert.equal(c.status,'no_observation');assert.equal(c.before,null);assert.equal(c.after,null);assert.equal(c.changeM,null);continue;}
  if(c.status==='baseline'){assert.equal(year,1993);assert.equal(c.changeM,null);assert.deepEqual(f.geometry.coordinates,[c.before.point,c.before.point]);}
  if(c.status==='estimated'){
   assert.ok(c.baselineEstimate||c.estimate);assert.ok(c.before&&c.after);
   assert.equal(c.beforeCut,null,'The modeled1993 base has no invented observation record');
   assert.equal(c.before,index.baselineValues.get(c.id));
   assert.equal(c.changeM,Math.round(((c.after.raw_interpolated_position_m??c.after.value)-(c.before.raw_interpolated_position_m??c.before.value))/10)*10);
   assert.deepEqual(f.geometry.coordinates,[c.before.point,c.after.point]);
   assert.equal(evolutionRuler(c,[0,0]),null,'A modeled base cannot produce a ruler labelled as measured');
   const labels=evolutionBarLabels(c);assert.match(labels.find(x=>x.kind==='baseline').text,/1993.*estimada/);
   assert.match(evolutionMessage(c),/estimad/);assert.match(evolutionMessage(c),/asistida por ChatGPT/);assert.equal(f.properties.evolution_comparison_provenance,'project_estimate_assisted_by_chatgpt');
   assert.equal(f.properties.evolution_before_date,null);
   if(c.afterCut){
    counts.observed_current_endpoints++;assert.equal(Number(c.afterCut.datetime.slice(0,4)),year);
    assert.deepEqual(c.after,index.annualValues.get(year).get(c.id).measurement,'The observed current position is retained');
    assert.equal(c.estimate,undefined);assert.equal(f.properties.evolution_after_date,c.afterCut.datetime);
    assert.match(labels.find(x=>x.kind==='current').text,/Agua observada/);
    examples.observed_endpoint??={id:c.id,year,date:c.afterCut.datetime,change_m:c.changeM};
   }else{
    counts.estimated_current_endpoints++;assert.ok(c.estimate);assert.ok(year<=2021&&year!==2012);
    assert.equal(f.properties.evolution_after_date,null);
    examples.modeled_endpoint??={id:c.id,year,change_m:c.changeM};
   }
  }
  if(c.status==='no_reference'||c.status==='no_observation')assert.equal(c.changeM,null);
 }
 assert.equal(counts.available,0,'No result may be called fully observed without an observed1993 base');
 if(year===2012)assert.equal(counts.estimated,0,'No interpolation bridges the missing2012 period');
 if(year>2021)assert.equal(counts.estimated_current_endpoints,0,'No endpoint extrapolation beyond published periods');
 coverage.push(counts);
}
// Explicit synthetic fixtures exercise genuine1993 bases and missing/modelled cases.
const measurement=(id,value)=>({transect_id:id,value,raw_interpolated_position_m:value,point:[-89.7+value*0.00001,21.3],quality:'accepted',change_m:null});
const cut=(id,date,value)=>({id,datetime:date+'T00:00:00.000Z',variable:'waterline_position',unit:'m',origin:'landsat',product:{id:'TEST_'+id},source_url:'https://example.test/'+id,measurements:[measurement('fixture',value)],method_id:'test-fixture',quality_note:'Synthetic test fixture'});
const fixture=observations=>({schema_version:1,baseline_year:1986,baseline_observation_id:null,generated_at:'test-fixture',observations,quality_note:'Synthetic tests only',reviewed_1986_products:0});
const genuine=fixture([cut('old','1986-01-01',10),cut('base','1993-06-01',100),cut('later','1995-01-01',150)]);
const measured=createEvolutionIndex(validateEvolutionCatalogue(genuine),{referencePolicy:'1993'});
assert.equal(evolutionComparison(measured,'fixture',1995).status,'available');assert.equal(evolutionComparison(measured,'fixture',1995).changeM,50);assert.equal(evolutionComparison(measured,'fixture',1995).beforeCut.id,'base');
const missing=createEvolutionIndex(fixture([cut('later','1995-01-01',150)]),{referencePolicy:'1993'});
assert.equal(evolutionComparison(missing,'fixture',1995).status,'no_reference');assert.equal(evolutionComparison(missing,'fixture',1995).changeM,null);
const model={schema_version:1,method_id:'alec-anchored-trend-v1',source_url:'https://example.test/study',periods:{L5:{start:1986,end:2011},L8:{start:2013,end:2021},S2:{start:2016,end:2021}},models:[{transect_id:'fixture',series:'L5',rate_m_year:2,anchor_observation_id:'old',step_degrees_per_metre:[0.00001,0]}],limits:'Synthetic tests',input_sha256:{}};
const modeled=createEvolutionIndex(fixture([cut('old','1986-01-01',10),cut('later','1995-01-01',150)]),{referencePolicy:'1993',trends:model});
const modeledBase=evolutionComparison(modeled,'fixture',1995);assert.equal(modeledBase.status,'estimated');assert.equal(modeledBase.afterCut.id,'later');assert.equal(modeledBase.estimate,undefined);assert.ok(modeledBase.baselineEstimate);assert.equal(modeledBase.beforeCut,null);
const measuredBaseModeledEnd=createEvolutionIndex(genuine,{referencePolicy:'1993',trends:model});
assert.equal(evolutionComparison(measuredBaseModeledEnd,'fixture',1994).status,'estimated');assert.equal(evolutionComparison(measuredBaseModeledEnd,'fixture',1994).baselineEstimate,undefined);assert.ok(evolutionComparison(measuredBaseModeledEnd,'fixture',1994).estimate);
assert.equal(JSON.stringify(catalogue),snapshot,'Accepted observations were not changed');
assert.equal(sha(await bytes('public/data/littoral/coastal-evolution.json')),'67cb0b1be1004defbe877b022f6a899e488d8f9315e3ca7c3eab74bbb46fbf52');
for(const[path,expected]of Object.entries(trends.input_sha256))assert.equal(sha(await bytes(path)),expected);
const report={checked_at:new Date().toISOString(),status:'passed',fixed_base_year:1993,observed_bases:index.references.size,modeled_bases:index.baselineEstimates.size,checked_axis_years:checked,examples,coverage,checks:['Real1993 bases override earlier observations','Missing1993 bases never become zero or a neighboring-year reference','Modeled1993 base makes the whole comparison estimated even with an observed current endpoint','Each observed endpoint retains its true date and product','Only existing forward anchored models and their published periods','No comparison before1993 or invented2012 bridge','Original accepted observations and model source hashes unchanged']};
await writeFile(new URL('docs/qa/fixed-1993-evolution-2026-10-28.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,coverage:undefined}));
