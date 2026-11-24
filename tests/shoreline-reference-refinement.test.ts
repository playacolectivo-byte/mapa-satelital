import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyShorelineReferenceRefinement,type ShorelineReferenceRefinement} from '../lib/shoreline-reference-refinement.ts';
import {validatePhotoCoast,type PhotoCoastData} from '../lib/photo-coast.ts';

const hash='a'.repeat(64);
const fixture=():PhotoCoastData=>({version:1,method:'fixture',field_validated:false,model_sha256:hash,captures:[{date:'2011-08-01',provider:'Maxar',source:'WV02',resolution_m:.5,accuracy_m:10},{date:'2025-02-13',provider:'Maxar',source:'WV03',resolution_m:.5,accuracy_m:10}],targets:[{id:'A',readings:[{capture:0,offset_m:-18,accepted:true,spread_m:5,reasons:[],releases:[11019],manual_review:{id:'old',source:'old-source',uncertainty_m:8}},{capture:1,offset_m:30,accepted:true,spread_m:5,reasons:[],releases:[22252]}],fixed_reference:{capture:0,method:'old',source:'old-source',verified_release:11019},review_policy:{method:'old',reference_capture:0,first_year:2011,last_year:2025,reviewed_releases:[11019,22252],reviewed_captures:[{capture:0,releases:[11019]},{capture:1,releases:[22252]}]}}]});
const review:ShorelineReferenceRefinement={version:1,status:'independently_reviewed',reference_year:2011,method:'refined2011',field_validated:false,data_sha256:hash,model_sha256:hash,sources:[{id:'new-source',release:11019,capture_date:'2011-08-01',screenshot_sha256:hash}],corrections:[{profile_id:'A',capture:0,date:'2011-08-01',releases:[11019],original_offset_m:-18,original_accepted:true,offset_m:.3,manual_uncertainty_m:8,source:'new-source'}]};

test('a shoreline correction refines only 2011 and preserves every later observed position and approval',()=>{
 const data=fixture(),before=structuredClone(data),after=validatePhotoCoast(applyShorelineReferenceRefinement(data,review,hash));
 assert.deepEqual(data,before);assert.equal(after.targets[0].readings[0].offset_m,.3);
 assert.deepEqual(after.targets[0].readings[1],before.targets[0].readings[1]);
 assert.deepEqual(after.targets[0].review_policy!.reviewed_captures!.find(r=>r.capture===1),before.targets[0].review_policy!.reviewed_captures!.find(r=>r.capture===1));
 assert.equal(after.targets[0].fixed_reference!.source,'new-source');assert.equal(after.targets[0].fixed_reference!.capture,0);
 assert.equal(after.targets[0].readings[1].offset_m!-after.targets[0].readings[0].offset_m!,29.7);
 assert.throws(()=>applyShorelineReferenceRefinement(data,{...review,status:'proposed'},hash));
 assert.throws(()=>applyShorelineReferenceRefinement(data,{...review,corrections:[{...review.corrections[0],date:'2025-02-13'}]},hash));
 assert.throws(()=>applyShorelineReferenceRefinement(after,review,hash));
});

test('an interpretable dated 2011 contact can recover a pending locator without approving previously unknown years',()=>{
 const data=fixture();delete data.targets[0].fixed_reference;
 data.targets[0].reference_unavailable={year:2011,reason:'old_ambiguous_contact',method:'old',method_url:'/old'};
 data.targets[0].review_policy!.reference_capture=-1;data.targets[0].review_policy!.reviewed_captures=[];
 const result=validatePhotoCoast(applyShorelineReferenceRefinement(data,review,hash));
 assert.equal(result.targets[0].reference_unavailable,undefined);assert.ok(result.targets[0].fixed_reference);
 assert.deepEqual(result.targets[0].review_policy!.reviewed_captures,[{capture:0,releases:[11019]}]);
});

test('an obscured shoreline retires the old baseline without deleting the archived observation',()=>{
 const data=fixture();const result=validatePhotoCoast(applyShorelineReferenceRefinement(data,{...review,corrections:[],sources:[],uninterpretable_references:[{profile_id:'A',capture:0,reason:'structure_or_shadow_prevents_unique_sand_water_contact',original_offset_m:-18,original_accepted:true}]},hash));
 assert.equal(result.targets[0].fixed_reference,undefined);assert.ok(result.targets[0].reference_unavailable);
 assert.deepEqual(result.targets[0].readings,data.targets[0].readings);
 assert.deepEqual(result.targets[0].review_policy!.reviewed_captures,[{capture:1,releases:[22252]}]);
});
