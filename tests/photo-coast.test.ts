import {test} from 'node:test';
import assert from 'node:assert/strict';
import {photoCoastPosition,photoCoastComparison,photoCoastBaselineYear,photoCoastCoordinate,compatiblePhotoCoastLayer,displayedPhotoCoastPresentation,validatePhotoCoast,type PhotoCoastPresentation,type PhotoCoastData} from '../lib/photo-coast.ts';
import type {CoastalScenario} from '../lib/coastal-scenario.ts';
const data:PhotoCoastData={version:1,method:'rgb-visible-boundary-v1',field_validated:false,model_sha256:'fixture',captures:[{date:'2011-08-01',provider:'Example',source:'Example',resolution_m:.5,accuracy_m:10},{date:'2015-03-01',provider:'Example',source:'Example',resolution_m:.5,accuracy_m:5},{date:'2025-04-14',provider:'Example',source:'Example',resolution_m:.6,accuracy_m:5}],targets:[{id:'A',readings:[{capture:0,offset_m:-35,spread_m:2,releases:[1],accepted:true,reasons:[]},{capture:1,offset_m:-25,spread_m:3,releases:[2],accepted:true,reasons:[]},{capture:2,offset_m:-10,spread_m:2,releases:[3],accepted:true,reasons:[]}]}]};
const model={targets:[{id:'A',m:'Progreso',p:[-89.6,21.2],v:[0,1],type:'Playa',municipality_approximate:false}],coordinate_scale:[103715,111320]} as unknown as CoastalScenario;

test('actual photo offsets replace the previous invented displacement',()=>{
 validatePhotoCoast(data);
 const reading=photoCoastPosition(data,data.targets[0].readings,2011,1)!;
 assert.equal(reading.offset,-35);assert.equal(reading.kind,'photo');assert.equal(reading.date,'2011-08-01');
 const line=photoCoastComparison(model,data,2011,2025,3).features[0];
 assert.equal(line.properties.delta_m,25);
 assert.equal(line.properties.scenario_unvalidated,false);assert.equal(line.properties.photo_interpretation,true);
 if(line.geometry.type!=='LineString')assert.fail();
 assert.deepEqual(line.geometry.coordinates[1],photoCoastCoordinate(model.targets[0],-10));
});
test('a missing 2010 photo uses the accepted 2011 photograph without inventing 2010',()=>{
 const f=photoCoastComparison(model,data,2010,2025,3).features[0];
 assert.equal(f.properties.baseline_year,2011);assert.equal(f.properties.comparison_start_year,2011);
 assert.equal(f.properties.photo_baseline_fallback,true);assert.equal(f.properties.photo_start_kind,'photo');
 assert.equal(f.properties.date_before,'2011-08-01');assert.equal(f.properties.estimated,false);assert.equal(f.properties.delta_m,25);
});
test('an accepted 2010 photo remains the reference when 2011 is also available',()=>{
 const d=structuredClone(data);d.captures.push({...d.captures[0],date:'2010-12-01'});d.targets[0].readings.push({capture:3,offset_m:-40,spread_m:2,releases:[4],accepted:true,reasons:[]});
 const f=photoCoastComparison(model,d,2010,2025,3).features[0];
 assert.equal(f.properties.baseline_year,2010);assert.equal(f.properties.photo_baseline_fallback,false);assert.equal(f.properties.date_before,'2010-12-01');assert.equal(f.properties.delta_m,30);
});
test('a single accepted 2011 photograph can be a reference, not a reconstructed 2010 trend',()=>{
 const readings=[data.targets[0].readings[0]];assert.equal(photoCoastBaselineYear(data,readings),2011);
 const d={...data,targets:[{id:'A',readings}]};
 const start=photoCoastComparison(model,d,2010,2011,1).features[0];assert.equal(start.properties.baseline_year,2011);assert.equal(start.properties.reference_only,true);assert.equal(start.properties.delta_m,0);
 const before=photoCoastComparison(model,d,2010,2010,1).features[0];assert.equal(before.properties.delta_m,null);assert.equal(before.properties.photo_end_kind,null);
});
test('missing or rejected references from both 2010 and 2011 stay pending',()=>{
 const d=structuredClone(data);d.targets[0].readings[0].accepted=false;d.targets[0].readings[0].reasons=['water_classifier_ambiguous'];
 const f=photoCoastComparison(model,d,2010,2025,3).features[0];assert.equal(f.properties.baseline_year,null);assert.equal(f.properties.delta_m,null);assert.equal(f.properties.photo_start_kind,null);
});
test('missing long-range extrapolation or rejected photos never become zero change',()=>{
 assert.equal(photoCoastPosition(data,data.targets[0].readings,2021,null)?.kind,'interpolated');
 assert.equal(photoCoastPosition(data,data.targets[0].readings,2027,null),null);
 const rejected=structuredClone(data);rejected.targets[0].readings[0].accepted=false;rejected.targets[0].readings[0].reasons=['parallel_transects_disagree'];
 const f=photoCoastComparison(model,rejected,2010,2011,1).features[0];
 assert.equal(f.properties.delta_m,null);assert.equal(f.properties.context_review,true);assert.equal(f.properties.photo_location_matched,false);
});
test('a different photo year does not masquerade as the requested analysis year',()=>{
 const f=photoCoastComparison(model,data,2010,2026,3).features[0];
 assert.equal(f.properties.photo_mismatch,true);assert.equal(f.properties.photo_date,'2025-04-14');assert.equal(f.properties.delta_m,null);
 if(f.geometry.type!=='LineString')assert.fail();assert.deepEqual(f.geometry.coordinates[0],f.geometry.coordinates[1]);
});
test('one photo cannot establish a historical trend or a 2010 position',()=>{
 const readings=[data.targets[0].readings[2]];
 assert.equal(photoCoastPosition(data,readings,2010,null),null);
 assert.equal(photoCoastPosition(data,readings,2026,null),null);
 assert.equal(photoCoastPosition(data,readings,2025,3)?.kind,'photo');
});
test('the selected reference year never compares two different captures of that same year',()=>{
 const d=structuredClone(data);d.captures.push({...d.captures[0],date:'2011-12-01'});d.targets[0].readings.push({capture:3,offset_m:80,spread_m:2,releases:[4],accepted:true,reasons:[]});
 const f=photoCoastComparison(model,d,2011,2011,1).features[0];
 assert.equal(f.properties.reference_only,true);assert.equal(f.properties.delta_m,0);
 if(f.geometry.type!=='LineString')assert.fail();assert.deepEqual(f.geometry.coordinates[0],f.geometry.coordinates[1]);
});
test('metadata inventories and bad accepted readings fail validation',()=>{
 const invalid=structuredClone(data);invalid.targets[0].readings[0].offset_m=Infinity;
 assert.throws(()=>validatePhotoCoast(invalid));
 const wrong=structuredClone(data);wrong.targets[0].id='Other';
 assert.throws(()=>photoCoastComparison(model,wrong,2010,2025,3));
});

test('only compatible photographic comparisons are clickable; mismatched and interpolated endpoints are excluded',()=>{
 assert.equal(compatiblePhotoCoastLayer(photoCoastComparison(model,data,2010,2025,3),'Progreso').features.length,1);
 assert.equal(compatiblePhotoCoastLayer(photoCoastComparison(model,data,2010,2025,3),'Ixil').features.length,0);
 assert.equal(compatiblePhotoCoastLayer(photoCoastComparison(model,data,2010,2026,3),'Progreso').features.length,0);
 assert.equal(compatiblePhotoCoastLayer(photoCoastComparison(model,data,2010,2021,null),'Progreso').features.length,0);
 const reference=compatiblePhotoCoastLayer(photoCoastComparison(model,data,2010,2011,1),'Progreso');
 assert.equal(reference.features.length,1);assert.equal(reference.features[0].properties.reference_only,true);
 const rejected=structuredClone(data);rejected.targets[0].readings[0].accepted=false;
 assert.equal(compatiblePhotoCoastLayer(photoCoastComparison(model,rejected,2010,2025,3),'Progreso').features.length,0);
});

test('an in-flight year retains the result layer of the visible photograph, then commits the new pair atomically',()=>{
 const layer=photoCoastComparison(model,data,2010,2025,3);
 const previous:PhotoCoastPresentation={scope:'Progreso',year:2011,frameKey:'esri:1',layer};
 const next:PhotoCoastPresentation={scope:'Progreso',year:2025,frameKey:'esri:3',layer};
 for(let pan=0;pan<120;pan++)assert.equal(displayedPhotoCoastPresentation('Progreso','esri:1',next,previous),previous);
 assert.equal(displayedPhotoCoastPresentation('Progreso','esri:3',next,previous),next);
 assert.equal(displayedPhotoCoastPresentation('Progreso','esri:3',next,next),next);
 // An unrelated frame, first load or another locality never inherits numbers.
 assert.equal(displayedPhotoCoastPresentation('Progreso','esri:99',next,previous),null);
 assert.equal(displayedPhotoCoastPresentation('Progreso',null,next,previous),null);
 assert.equal(displayedPhotoCoastPresentation('Ixil','esri:1',next,previous),null);
});
