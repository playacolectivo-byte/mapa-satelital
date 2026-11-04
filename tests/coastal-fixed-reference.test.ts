import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateCoastalScenario} from '../lib/coastal-scenario.ts';
import {validatePhotoCoast,photoCoastCoordinate} from '../lib/photo-coast.ts';
import {applyPhotoDigitization,type PhotoDigitization} from '../lib/photo-digitization.ts';
import {applyPhotoVisualReview} from '../lib/photo-visual-review.ts';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import type {PhotoSourceReview} from '../lib/photo-source-review.ts';

const read=(p:string)=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const folder='public/data/shorelines/photo-alignment/';
const raw=readFileSync(new URL('../'+folder+'revised-data.json',import.meta.url));
const sha=createHash('sha256').update(raw).digest('hex');
const model=validateCoastalScenario(read('public/data/shorelines/scenario/model.json'));
const original=validatePhotoCoast(JSON.parse(raw.toString()));
const visual=applyPhotoVisualReview(original,read(folder+'revised-visual-review.json'),sha);
const digitization=read(folder+'manual-digitization-20261103.json') as PhotoDigitization;
const photos=validatePhotoCoast(applyPhotoDigitization(visual,digitization,sha));
const sourceReview=read(folder+'revised-source-review.json') as PhotoSourceReview;

test('29 documented manual positions are separate from immutable automated candidates',()=>{
 assert.equal(digitization.corrections.length,29);
 for(const c of digitization.corrections){
  const old=original.targets.find(t=>t.id===c.profile_id)!.readings.find(r=>r.capture===c.capture)!;
  const current=photos.targets.find(t=>t.id===c.profile_id)!.readings.find(r=>r.capture===c.capture)!;
  assert.equal(old.offset_m,c.original_offset_m);assert.equal(old.accepted,false);
  assert.equal(current.offset_m,c.offset_m);assert.equal(current.accepted,true);
  assert.equal(current.manual_review?.uncertainty_m,6);
 }
 assert.equal(createHash('sha256').update(raw).digest('hex'),sha);
 assert.throws(()=>applyPhotoDigitization(visual,{...digitization,data_sha256:'other'},sha));
});

test('all beaches, years and received editions retain exactly the same reference coordinate',()=>{
 const cache=createCoastalImageAlignment(model,photos,sourceReview),fixed=new Map<string,unknown>();
 const ids=model.targets.filter(t=>t.type.startsWith('Playa')).map(t=>t.id);
 const releases=read('public/data/history/esri-local-captures.json').items.map((x:{releaseNum:number})=>x.releaseNum);
 for(const year of model.years)for(const release of releases){
  const frame=cache.read(year,release);assert.deepEqual(frame.layer.features.map(f=>f.id),ids);
  assert.equal(new Set(frame.layer.features.map(f=>f.properties.municipality)).size,13);
  for(const f of frame.layer.features){
   assert.equal(f.properties.baseline_fixed,true);
   const id=String(f.id),base=f.properties.baseline_coordinate;
   if(!fixed.has(id))fixed.set(id,base);else assert.deepEqual(base,fixed.get(id),id+' moved its reference');
   if(f.geometry.type==='LineString')assert.deepEqual(f.geometry.coordinates[0],base);
   if(f.properties.trajectory_estimate===true){assert.equal(f.properties.estimated,true);assert.equal(f.properties.photo_interpretation,false);}
  }
 }
});

test('Chelem starts on the traced 2011 boundary, and the 2025 bar uses its recalculated photographic difference',()=>{
 const cache=createCoastalImageAlignment(model,photos,sourceReview);
 const id='SC-90-0-20',t=model.targets.find(t=>t.id===id)!;
 const before=cache.read(2011,11019).layer.features.find(f=>f.id===id)!;
 const after=cache.read(2025,22252).layer.features.find(f=>f.id===id)!;
 assert.equal(before.geometry.type,'LineString');assert.equal(after.geometry.type,'LineString');
 if(before.geometry.type!=='LineString'||after.geometry.type!=='LineString')throw new Error('Missing bars');
 assert.equal(before.properties.delta_m,0);assert.equal(before.properties.reference_only,true);
 assert.deepEqual(before.geometry.coordinates[0],photoCoastCoordinate(t,-63.1));
 assert.deepEqual(before.geometry.coordinates[0],after.geometry.coordinates[0]);
 assert.equal(after.properties.delta_m,63.1);assert.equal(after.properties.photo_interpretation,true);
 assert.notEqual(after.properties.delta_m,after.properties.scenario_original_delta_m);
 assert.deepEqual(after.geometry.coordinates[1],photoCoastCoordinate(t,0));
});
