import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyMunicipalShorelineReview,type MunicipalShorelineReview} from '../lib/municipal-shoreline-review.ts';
import {validatePhotoCoast,photoCoastComparison,photoCoastCoordinate,type PhotoCoastData} from '../lib/photo-coast.ts';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {compatibleSourceLayer,type PhotoSourceReview} from '../lib/photo-source-review.ts';
const hash='a'.repeat(64);
const source=JSON.parse(readFileSync(new URL('../public/data/shorelines/scenario/model.json',import.meta.url),'utf8'));
const model={...source,targets:source.targets.slice(0,3).map((t:object,i:number)=>({...t,id:['A','B','C'][i],type:'Playa arenosa',m:'Progreso'}))};
const data:PhotoCoastData={version:1,method:'fixture',field_validated:false,model_sha256:hash,captures:['2011-08-01','2015-03-26','2025-02-13','2012-01-01'].map(date=>({date,provider:'fixture',source:'WV02',resolution_m:.5,accuracy_m:10})),targets:[{id:'A',readings:[{capture:0,offset_m:10,spread_m:5,releases:[1],accepted:false,reasons:['wrong_edge']},{capture:1,offset_m:20,spread_m:5,releases:[2,3],accepted:true,reasons:[]},{capture:2,offset_m:30,spread_m:5,releases:[4],accepted:true,reasons:[]}]},{id:'B',readings:[{capture:3,offset_m:2,spread_m:5,releases:[1],accepted:true,reasons:[]}]},{id:'C',readings:[{capture:0,offset_m:5,spread_m:5,releases:[1],accepted:false,reasons:['ambiguous']}]}]};
const review:MunicipalShorelineReview={version:1,status:'independently_reviewed',data_sha256:hash,model_sha256:hash,method:'dated-manual-fixture',field_validated:false,reference_year:2011,sources:[{id:'view-A',release:1,capture_date:'2011-08-01',screenshot_sha256:hash}],corrections:[{profile_id:'A',capture:0,date:'2011-08-01',releases:[1],original_offset_m:10,original_accepted:false,offset_m:12,manual_uncertainty_m:8,source:'view-A'}],reference_captures:[{profile_id:'A',capture:0,date:'2011-08-01'}],reference_gaps:[{profile_id:'B',year:2011,reason:'no_dated_2011_photograph'}],reviewed_readings:[{profile_id:'A',capture:1,releases:[2],visual_status:'accepted'}],rejected_readings:[{profile_id:'A',capture:1,releases:[3],reason:'actual_date_differs_at_endpoint'}]};

test('a missing real 2011 reference stays pending; explicit reviews never approve unrelated dates or editions',()=>{
 const before=structuredClone(data),after=validatePhotoCoast(applyMunicipalShorelineReview(data,review,hash));
 assert.deepEqual(data,before);assert.deepEqual(after.targets[2],before.targets[2]);
 assert.deepEqual(JSON.parse(JSON.stringify(after)),after);
 assert.deepEqual(after.targets[0].readings[1].releases,[2]);assert.equal(after.targets[0].readings[1].accepted,true);
 const cache=createCoastalImageAlignment(model,after);
 for(const year of [2011,2015,2025])for(const release of [1,2,3,4,null]){
  const frame=cache.read(year,release).layer.features;
  const gap=frame.find(f=>f.id==='B')!;assert.equal(gap.properties.delta_m,null);assert.equal(gap.properties.baseline_fixed,false);assert.equal(gap.properties.estimated,false);assert.equal(gap.properties.photo_review_pending,true);
  const a=frame.find(f=>f.id==='A')!;assert.equal(a.properties.baseline_year,2011);
  if(year===2015&&release===2){assert.equal(a.properties.photo_interpretation,true);assert.equal(a.properties.delta_m,8);assert.equal(a.properties.date_before,'2011-08-01');}
  else if(year!==2011||release!==1)assert.equal(a.properties.delta_m,null);
 }
 for(const [year,release] of [[2015,3],[2025,4]]){const f=photoCoastComparison(model,after,2011,year,release).features.find(f=>f.id==='A')!;assert.equal(f.properties.delta_m,null);}
 for(const year of [2013,2016]){const f=photoCoastComparison(model,after,2011,year,null).features.find(f=>f.id==='A')!;assert.equal(f.properties.delta_m,null);assert.equal(f.properties.estimated,false);assert.equal(f.properties.photo_review_pending,true);}
 assert.throws(()=>applyMunicipalShorelineReview(data,{...review,status:'proposed_for_independent_visual_review'},hash));
 assert.throws(()=>applyMunicipalShorelineReview(data,{...review,data_sha256:'b'.repeat(64)},hash));
 assert.throws(()=>applyMunicipalShorelineReview(data,{...review,reference_gaps:[...review.reference_gaps,{profile_id:'A',year:2011,reason:'contradiction'}]},hash));
 assert.throws(()=>applyMunicipalShorelineReview(data,{...review,corrections:[...review.corrections,{...review.corrections[0],profile_id:'C',original_offset_m:5}]},hash));
});

test('exact reviewed endpoint provenance can supersede a nominal-location source block only for its explicit edition',()=>{
 const after=validatePhotoCoast(applyMunicipalShorelineReview(data,review,hash));
 const blocked:PhotoSourceReview={version:1,algorithm:'source-aware-photo-anchors-v1',model_sha256:hash,data_sha256:hash,blocked:[{release:2,profile_id:'A',kind:'photo',actual:['2014-01-01','GE01',.5],position:model.targets[0].p,reason:'nominal_point_differs'}]};
 const f=createCoastalImageAlignment(model,after,blocked).read(2015,2).layer.features.find(f=>f.id==='A')!;assert.equal(f.properties.delta_m,8);assert.equal(f.properties.image_source_review,null);
 const strict=photoCoastComparison(model,after,2011,2015,2);assert.equal(compatibleSourceLayer(strict,2,blocked).features.filter(f=>f.id==='A').length,1);
 const strictFeature=strict.features.find(f=>f.id==='A')!;assert.equal(strictFeature.properties.photo_review_method,review.method);assert.match(String(strictFeature.properties.method_url),/municipal-review/);
 assert.deepEqual(strictFeature.properties.photo_metadata_points,[{release:1,coordinate:photoCoastCoordinate(model.targets[0],12),date:'2011-08-01'},{release:2,coordinate:photoCoastCoordinate(model.targets[0],20),date:'2015-03-26'}]);
 const withoutApproval=structuredClone(after);withoutApproval.targets[0].review_policy!.reviewed_captures=withoutApproval.targets[0].review_policy!.reviewed_captures!.filter(r=>r.capture!==1);
 const unreviewed=createCoastalImageAlignment(model,withoutApproval,blocked).read(2015,2).layer.features.find(f=>f.id==='A')!;assert.equal(unreviewed.properties.delta_m,null);assert.equal(unreviewed.properties.photo_review_pending,true);
});

test('same-day captures keep the identity and metadata coordinate of the measured endpoint',()=>{
 const after=validatePhotoCoast(applyMunicipalShorelineReview(data,review,hash));
 after.captures.push({...after.captures[1],source:'GE01'});
 after.targets[0].readings.push({capture:4,offset_m:37,spread_m:5,releases:[5],accepted:true,reasons:[],manual_review:{id:'second-sensor-review',source:'second-view',uncertainty_m:8}});
 after.targets[0].review_policy!.reviewed_captures!.push({capture:4,releases:[5]});
 for(const [release,offset,edition] of [[null,37,5],[2,20,2]] as const){
  const f=photoCoastComparison(model,after,2011,2015,release).features.find(f=>f.id==='A')!;
  const endpoint=photoCoastCoordinate(model.targets[0],offset);
  assert.equal(f.properties.delta_m,offset-12);
  assert.ok(f.geometry.type==='LineString');
  assert.deepEqual(f.geometry.coordinates[1],endpoint);
  assert.deepEqual((f.properties.photo_metadata_points as {release:number;coordinate:number[];date:string}[]).at(-1),{release:edition,coordinate:endpoint,date:'2015-03-26'});
  assert.deepEqual(f.properties.photo_source_releases,release===null?[1,5]:[2,1]);
 }
 const aligned=createCoastalImageAlignment(model,after).read(2015,2).layer.features.find(f=>f.id==='A')!;
 assert.deepEqual(aligned.properties.photo_source_releases,[2,1]);
 assert.ok(!(aligned.properties.photo_manual_reviews as {id:string}[]).some(r=>r.id==='second-sensor-review'));
});
