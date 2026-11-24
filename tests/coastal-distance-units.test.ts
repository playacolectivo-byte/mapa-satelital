import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {photoCoastComparison,type PhotoCoastData} from '../lib/photo-coast.ts';
import type {CoastalScenario} from '../lib/coastal-scenario.ts';

// Numerical fixtures only, not shoreline observations. Distances were computed
// independently with the WGS84 Vincenty inverse for these frozen coordinates.
// The 100-unit north/south pixel offsets are not 100 physical metres.
const reference:[number,number]=[-89.59999999999998,21.2];
const cases=[
 {offset:-100,coordinate:[-89.59999999999998,21.199101681984438],signedMetres:-99.46143889521879},
 {offset:100,coordinate:[-89.59999999999998,21.200898312552617],signedMetres:99.46084460857178},
] as const;

function fixture(offset:number){
 const years=Array.from({length:17},(_,i)=>2010+i);
 const model:CoastalScenario={version:1,scenario_unvalidated:true,years,anchorYears:[2011,2025],
  sources:[{id:'numerical-fixture',m:'Progreso',p:[-89.6,21.2]}],anchors:[[0],[0]],
  targets:[{id:'numerical-fixture',parent:'numerical-fixture',m:'Progreso',p:[-89.6,21.2],v:[0,1],type:'Playa',municipality_approximate:false,d:years.map(y=>y===2025?offset:0),support:[[0],[0]]}],
  coordinate_scale:[103715,111320],source_hashes:{},municipalities:['Progreso']};
 const photos:PhotoCoastData={version:1,method:'numerical-fixture',field_validated:false,model_sha256:'0'.repeat(64),
  captures:[{date:'2011-08-01',provider:'Fixture',source:'Fixture',resolution_m:.5,accuracy_m:5},{date:'2025-04-14',provider:'Fixture',source:'Fixture',resolution_m:.5,accuracy_m:5}],
  targets:[{id:'numerical-fixture',readings:[{capture:0,offset_m:0,spread_m:1,releases:[1],accepted:true,reasons:[]},{capture:1,offset_m:offset,spread_m:1,releases:[2],accepted:true,reasons:[]}]}]};
 return {model,photos};
}

test('both photographic paths report signed WGS84 metres without moving their source coordinates',()=>{
 for(const sample of cases){
  const {model,photos}=fixture(sample.offset),before=JSON.stringify({model,photos});
  const alignment=createCoastalImageAlignment(model,photos);
  const layers=[alignment.read(2025,2).layer,photoCoastComparison(model,photos,2010,2025,2)];
  for(const layer of layers){
   const f=layer.features[0];
   assert.deepEqual(f.geometry,{type:'LineString',coordinates:[reference,[...sample.coordinate]]});
   assert.ok(Math.abs(Number(f.properties.delta_m)-sample.signedMetres)<.001);
   assert.ok(Math.abs(Number(f.properties.delta_m)-sample.offset)>.5,'raw pixel offset must not be labelled as ground metres');
   assert.equal(f.properties.photo_interpretation,true);
   assert.equal(f.properties.estimated,false);
   assert.equal(f.properties.date_before,'2011-08-01');
   assert.equal(f.properties.date_after,'2025-04-14');
  }
  const start=alignment.read(2011,1).layer.features[0];
  assert.equal(start.properties.delta_m,0);
  assert.deepEqual(start.geometry,{type:'LineString',coordinates:[reference,reference]});
  assert.equal(JSON.stringify({model,photos}),before,'unit conversion must not modify observations or the model');
 }
});

test('the estimated path uses the same ground-metre units and retains its original model and unvalidated status',()=>{
 for(const sample of cases){
  const {model,photos}=fixture(sample.offset);
  photos.targets[0].readings=photos.targets[0].readings.slice(0,1);
  const before=JSON.stringify({model,photos});
  const f=createCoastalImageAlignment(model,photos).read(2025,null).layer.features[0];
  assert.deepEqual(f.geometry,{type:'LineString',coordinates:[reference,[...sample.coordinate]]});
  assert.ok(Math.abs(Number(f.properties.delta_m)-sample.signedMetres)<.001);
  assert.equal(f.properties.scenario_delta_m,f.properties.delta_m);
  assert.equal(f.properties.scenario_original_delta_m,sample.offset);
  assert.equal(f.properties.estimated,true);
  assert.equal(f.properties.scenario_unvalidated,true);
  assert.equal(f.properties.photo_interpretation,false);
  assert.equal(f.properties.trajectory_end_kind,'model');
  assert.equal(JSON.stringify({model,photos}),before);
 }
});
