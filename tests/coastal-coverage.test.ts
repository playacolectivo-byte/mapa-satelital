import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessmentCoverage,municipalCoverage} from '../lib/coastal-coverage.ts';
const index={type:'FeatureCollection' as const,features:[0,1,2].map(i=>({type:'Feature' as const,geometry:{type:'LineString' as const,coordinates:[[1,1],[2,2]]},properties:{profile_id:String(i),municipality:i===2?'B':'A'}}))};
const years={profile_ids:['0','1','2'],years:{2026:{status:[0,1,2],delta_m:[null,-3,5],direction_unresolved:[true,false,true]}}};
test('coverage marks unknown stretches without inventing a shoreline displacement',()=>{
 const data=assessmentCoverage(index,years,2026);assert.equal(data.features[0].properties.assessment_delta,null);assert.equal(data.features[0].properties.delta_m,undefined);assert.equal(data.features[2].properties.estimated,true);assert.deepEqual(data.features[0].geometry,index.features[0].geometry);
 assert.deepEqual(municipalCoverage(data),[{municipality:'A',total:2,processed:1,estimated:0,unresolved:1},{municipality:'B',total:1,processed:0,estimated:1,unresolved:0}]);
});
test('annual coverage is not reused as evidence for a 2015 reference comparison',()=>{
 const data=assessmentCoverage(index,years,2026,true);assert.ok(data.features.every(feature=>feature.properties.assessment_status===0&&feature.properties.assessment_delta===null));
 assert.ok(assessmentCoverage(index,years,2015).features.every(feature=>feature.properties.assessment_status===0));
});
test('mismatched coverage inventories fail instead of assigning another profile evidence',()=>{
 assert.throws(()=>assessmentCoverage(index,{...years,profile_ids:['2','1','0']},2026));
});

test('cumulative2020 uses its own statuses and deltas rather than the annual comparison',()=>{
 const cumulative={...years,years:{2026:{...years.years[2026],reference2020:{status:[1,0,2],delta_m:[-17,null,21],direction_unresolved:[false,true,true]}}}};
 const annual=assessmentCoverage(index,cumulative,2026),reference=assessmentCoverage(index,cumulative,2026,'2020');
 assert.equal(annual.features[0].properties.assessment_delta,null);assert.equal(reference.features[0].properties.assessment_delta,-17);assert.equal(reference.features[1].properties.assessment_status,0);assert.equal(reference.features[1].properties.assessment_delta,null);assert.equal(reference.features[0].properties.assessment_reference_year,2020);
});
