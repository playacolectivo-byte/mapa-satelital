import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyPhotoVisualReview} from '../lib/photo-visual-review.ts';
import {photoCoastComparison,compatiblePhotoCoastLayer,type PhotoCoastData} from '../lib/photo-coast.ts';
import {municipalComparisonOptions} from '../lib/coastal-photo-scopes.ts';
const read=(path:string)=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const raw=readFileSync(new URL('../public/data/shorelines/photo-alignment/data.json',import.meta.url));
const data:PhotoCoastData=JSON.parse(raw.toString()),sha=createHash('sha256').update(raw).digest('hex');
const review=read('public/data/shorelines/photo-alignment/visual-review.json');
void test('visual review removes only nine recorded candidates, without mutating original offsets or observations',()=>{
 const before=JSON.stringify(data),reviewed=applyPhotoVisualReview(data,review,sha);
 let changed=0;
 reviewed.targets.forEach((target,i)=>target.readings.forEach((reading,j)=>{
  const original=data.targets[i].readings[j];assert.equal(reading.offset_m,original.offset_m);assert.equal(reading.capture,original.capture);
  if(reading!==original){changed++;assert.equal(reading.accepted,false);assert.ok(reading.reasons.includes('manual_visual_discrepancy'));}
 }));
 assert.equal(changed,9);assert.equal(JSON.stringify(data),before);
 assert.throws(()=>applyPhotoVisualReview(data,review,'another version'));
 const stale=structuredClone(review);stale.exclusions[0].original_offset_m+=1;
 assert.throws(()=>applyPhotoVisualReview(data,stale,sha));
});
void test('every municipal menu still has compatible pairs after visual exclusions, and no excluded reading is used',()=>{
 const model=read('public/data/shorelines/scenario/model.json'),catalogue=read('lib/generated/municipal-photo-catalogue.json'),received=read('public/data/history/esri-local-captures.json');
 const reviewed=applyPhotoVisualReview(data,review,sha);
 for(const anchor of catalogue.anchors)for(const option of municipalComparisonOptions(received.items,catalogue,anchor.municipality,anchor.coordinates,17,anchor.coordinates)){
  const layer=compatiblePhotoCoastLayer(photoCoastComparison(model,reviewed,2010,option.year,option.item.releaseNum,anchor.municipality),anchor.municipality);
  assert.ok(layer.features.length>0,anchor.municipality+' '+option.year);
  for(const f of layer.features)assert.ok(!review.exclusions.some((r:{profile_id:string;date:string})=>r.profile_id===f.id&&(r.date===f.properties.date_before||r.date===f.properties.date_after)));
 }
});
