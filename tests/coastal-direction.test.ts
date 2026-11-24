import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coastalDirectionUnresolved,coastalApparentDirection} from '../lib/coastal-direction.ts';
test('overlapping captures keep an uncertain direction when a legacy boolean is absent or false',()=>{
  const legacy={delta_m:-3.3294191287837425,persistence_screen:'variacion_intrannual_se_superpone'};
  assert.equal(coastalDirectionUnresolved(legacy),true);
  assert.equal(coastalDirectionUnresolved({...legacy,direction_unresolved:false}),true);
  assert.equal(coastalDirectionUnresolved({...legacy,persistence_screen:legacy.persistence_screen+';native_quality'}),true);
});
test('an explicit uncertainty flag remains authoritative for modelled or processed records',()=>{
  assert.equal(coastalDirectionUnresolved({direction_unresolved:true,estimated:false}),true);
  assert.equal(coastalDirectionUnresolved({direction_unresolved:true,estimated:true}),true);
});
test('a signed result without an overlap warning is not reclassified solely because it is negative',()=>{
  assert.equal(coastalDirectionUnresolved({delta_m:-40,direction_unresolved:false,persistence_screen:'retroceso_consistente_en_muestras'}),false);
});

test('apparent direction uses the sign without removing scientific uncertainty',()=>{
  const retreat={delta_m:-11,direction_unresolved:true,registration_proxy_m:15,persistence_screen:'variacion_intrannual_se_superpone'};
  const snapshot=structuredClone(retreat);
  assert.equal(coastalApparentDirection(retreat),'toward-land');
  assert.equal(coastalApparentDirection({...retreat,delta_m:11}),'toward-water');
  assert.equal(coastalDirectionUnresolved(retreat),true);
  assert.deepEqual(retreat,snapshot);
});
test('zero and reference positions stay neutral; pending records have no displayed direction',()=>{
  assert.equal(coastalApparentDirection({delta_m:0}),'unchanged');
  assert.equal(coastalApparentDirection({delta_m:-0}),'unchanged');
  assert.equal(coastalApparentDirection({delta_m:4,reference_only:true}),'unchanged');
  for(const flag of ['context_review','photo_review_pending','before_reference'])assert.equal(coastalApparentDirection({delta_m:4,[flag]:true}),null);
});
test('missing values do not become zero or silently inherit a model estimate',()=>{
  for(const invalid of [null,NaN,Infinity,-Infinity,'12',false])assert.equal(coastalApparentDirection({delta_m:invalid,scenario_delta_m:12}),null);
  assert.equal(coastalApparentDirection({}),null);
  assert.equal(coastalApparentDirection({apparent_change_toward_water_m:-2}),'toward-land');
  assert.equal(coastalApparentDirection({scenario_delta_m:2}),'toward-water');
  assert.equal(coastalApparentDirection({delta_m:0,scenario_delta_m:-2}),'unchanged');
});
