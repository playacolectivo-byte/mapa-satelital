import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCENARIO_YEARS,createScenarioLayerCache,scenarioReferencePhoto} from '../lib/coastal-result-view.ts';
import {validateCoastalScenario} from '../lib/coastal-scenario.ts';
import type {CoastalPhotoOption} from '../lib/esri-coastal-photos.ts';
const model=validateCoastalScenario(JSON.parse(readFileSync(new URL('../public/data/shorelines/scenario/model.json',import.meta.url),'utf8')));

void test('the restored calendar keeps all 4356 original IDs in all 13 municipalities for each of 17 years',()=>{
 const cache=createScenarioLayerCache(model),ids=model.targets.map(t=>t.id);
 const chuburna=model.targets.filter(t=>t.m==='Progreso'&&t.p[0]>-89.84&&t.p[0]<-89.78).map(t=>t.id);
 assert.ok(chuburna.length>10,'the reported Chuburná sector must have modeled coverage');
 for(const year of SCENARIO_YEARS){
  const layer=cache.read(year);assert.deepEqual(layer.features.map(f=>f.id),ids);
  assert.equal(new Set(layer.features.map(f=>f.properties.municipality)).size,13);
  assert.equal(layer.features.filter(f=>chuburna.includes(String(f.id))).length,chuburna.length);
  layer.features.forEach((f,i)=>{
   const expected=model.targets[i].d.reduce((sum,d,j)=>sum+(model.years[j]>2010&&model.years[j]<=year?d:0),0);
   assert.equal(f.properties.delta_m,expected);assert.equal(f.properties.year,year);
   assert.equal(f.properties.scenario_unvalidated,true);assert.equal(f.properties.estimated,true);
   assert.equal(f.properties.reference_only,year===2010);assert.equal(f.properties.baseline_year,2010);
   assert.equal(f.properties.photo_interpretation,undefined);
  });
 }
 assert.throws(()=>cache.read(2009));assert.throws(()=>cache.read(2027));
});

void test('three computed years can be revisited without recalculation; an evicted year reproduces the same figures',()=>{
 const cache=createScenarioLayerCache(model),a=cache.read(2026),b=cache.read(2025);
 cache.read(2011);assert.equal(cache.read(2026),a);assert.equal(cache.read(2025),b);
 cache.read(2010);const restored=cache.read(2011);assert.equal(restored.features.length,4356);
 assert.deepEqual(restored.features.map(f=>f.properties.delta_m),model.targets.map(t=>t.d[1]));
});

const photo=(year:number,release:number)=>({year,date:year+'-03-01',item:{releaseNum:release},key:String(release)} as CoastalPhotoOption);
const photos=[photo(2011,1),photo(2020,2),photo(2025,3)];
void test('a model year without an exact photo retains a dated reference, never a renamed or invented acquisition',()=>{
 const raw=JSON.stringify(photos);
 assert.equal(scenarioReferencePhoto(photos,2011,3),photos[0]);
 assert.equal(scenarioReferencePhoto(photos,2018,3),photos[2]);
 assert.equal(scenarioReferencePhoto(photos,2018,1),photos[0]);
 assert.equal(scenarioReferencePhoto(photos,2026,null),photos[2]);
 assert.equal(scenarioReferencePhoto([],2026,null),null);
 assert.equal(JSON.stringify(photos),raw);
});
