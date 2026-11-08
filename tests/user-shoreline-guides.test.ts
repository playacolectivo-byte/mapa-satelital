import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyPhotoVisualReview} from '../lib/photo-visual-review.ts';
import {applyPhotoDigitization} from '../lib/photo-digitization.ts';
import {applyPhotoPilotReview} from '../lib/photo-pilot-review.ts';
import {applyUserShorelineGuides} from '../lib/user-shoreline-guides.ts';
import {validatePhotoCoast,photoCoastCoordinate,photoCoastComparison} from '../lib/photo-coast.ts';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
const read=(p:string)=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const folder='public/data/shorelines/photo-alignment/';
const raw=readFileSync(new URL('../'+folder+'revised-data.json',import.meta.url)),sha=createHash('sha256').update(raw).digest('hex');
const before=applyPhotoPilotReview(applyPhotoDigitization(applyPhotoVisualReview(validatePhotoCoast(JSON.parse(raw.toString())),read(folder+'revised-visual-review.json'),sha),read(folder+'manual-digitization-20261103.json'),sha),read(folder+'manual-progreso-oeste-20261105.json'),sha);
const review=read(folder+'user-guides-2011-20261105.json');
const after=validatePhotoCoast(applyUserShorelineGuides(before,review,sha));
const model=read('public/data/shorelines/scenario/model.json'),sourceReview=read(folder+'revised-source-review.json');

test('the 47 user-guided references preserve every other profile and all later readings',()=>{
 assert.equal(review.corrections.length,47);assert.equal(review.guides.length,6);
 const ids=new Set(review.corrections.map((c:{profile_id:string})=>c.profile_id));
 for(const [i,old] of before.targets.entries()){
  const current=after.targets[i];
  if(!ids.has(old.id))assert.deepEqual(current,old);
  else for(const reading of old.readings)if(reading.capture!==40)assert.deepEqual(current.readings.find(r=>r.capture===reading.capture),reading);
 }
 assert.throws(()=>applyUserShorelineGuides(before,{...review,data_sha256:'stale'},sha));
 assert.throws(()=>applyUserShorelineGuides(before,{...review,reference_date:'2011-12-01'},sha));
});

test('all years and image editions retain the same user reference; photographed endpoints stay in place',()=>{
 const cache=createCoastalImageAlignment(model,after,sourceReview),oldCache=createCoastalImageAlignment(model,before,sourceReview);
 for(const release of [11019,27946,18820,20753,17825,25285,22252,null])for(const year of [2010,2011,2013,2014,2019,2020,2022,2025]){
  const frame=cache.read(year,release),old=oldCache.read(year,release);
  for(const c of review.corrections){
   const f=frame.layer.features.find(f=>f.id===c.profile_id)!,p=f.properties;
   const target=model.targets.find((t:{id:string})=>t.id===c.profile_id);
   assert.deepEqual(p.baseline_coordinate,photoCoastCoordinate(target,c.offset_m));assert.equal(p.baseline_year,2011);
   if(year===2011&&release===11019){assert.equal(p.reference_only,true);assert.equal(p.delta_m,0);}
   if(year>2011&&p.photo_interpretation){
    const previous=old.layer.features.find(f=>f.id===c.profile_id)!;
    const reading=after.targets.find(t=>t.id===c.profile_id)!.readings.find(r=>r.releases.includes(release!))!;
    assert.equal(p.delta_m,reading.offset_m!-c.offset_m);
    if(previous.properties.photo_interpretation&&previous.geometry.type==='LineString'&&f.geometry.type==='LineString')assert.deepEqual(f.geometry.coordinates[1],previous.geometry.coordinates[1]);
   }
  }
 }
});

test('the photo-only calculation cannot replace August with a later 2011 capture',()=>{
 const frame=photoCoastComparison(model,after,2010,2025,22252,'Progreso');
 for(const c of review.corrections){const f=frame.features.find(f=>f.id===c.profile_id)!;assert.equal(f.properties.date_before,'2011-08-01');if(f.geometry.type==='LineString'&&f.properties.delta_m!==null)assert.deepEqual(f.geometry.coordinates[0],photoCoastCoordinate(model.targets.find((t:{id:string})=>t.id===c.profile_id),c.offset_m));}
});
