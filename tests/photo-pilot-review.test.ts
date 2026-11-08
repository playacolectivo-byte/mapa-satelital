import {applyUserShorelineGuides} from '../lib/user-shoreline-guides.ts';
import {applyCurrentMunicipalReviews} from '../lib/current-shoreline-reviews.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {applyPhotoVisualReview} from '../lib/photo-visual-review.ts';
import {applyPhotoDigitization} from '../lib/photo-digitization.ts';
import {applyPhotoPilotReview,withPhotoPilotCatalogue,type PhotoPilotReview} from '../lib/photo-pilot-review.ts';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {validatePhotoCoast,photoCoastCoordinate} from '../lib/photo-coast.ts';
import {municipalDatedOptions,type MunicipalPhotoCatalogue} from '../lib/coastal-photo-scopes.ts';

const read=(p:string)=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const folder='public/data/shorelines/photo-alignment/';
const raw=readFileSync(new URL('../'+folder+'revised-data.json',import.meta.url));
const sha=createHash('sha256').update(raw).digest('hex');
const review=read(folder+'manual-progreso-oeste-20261105.json') as PhotoPilotReview;
const before=applyPhotoDigitization(applyPhotoVisualReview(validatePhotoCoast(JSON.parse(raw.toString())),read(folder+'revised-visual-review.json'),sha),read(folder+'manual-digitization-20261103.json'),sha);
const photos=validatePhotoCoast(applyPhotoPilotReview(before,review,sha));
const model=read('public/data/shorelines/scenario/model.json');
const sourceReview=read(folder+'revised-source-review.json');

test('154 individually dated intersections change only the 22 specified profiles',()=>{
 assert.equal(review.profile_ids.length,22);assert.equal(review.corrections.length,154);
 assert.deepEqual(review.profile_ids,Array.from({length:22},(_,i)=>'SC-258-0-'+(i+30)));
 for(const old of before.targets){const current=photos.targets.find(t=>t.id===old.id)!;if(!review.profile_ids.includes(old.id))assert.deepEqual(current,old);}
 for(const c of review.corrections){const r=photos.targets.find(t=>t.id===c.profile_id)!.readings.find(r=>r.capture===c.capture)!;assert.equal(r.offset_m,c.offset_m);assert.equal(r.manual_review?.id,review.method);assert.equal(photos.captures[r.capture].date,c.date);}
 assert.equal(createHash('sha256').update(raw).digest('hex'),sha);
 assert.throws(()=>applyPhotoPilotReview(before,{...review,reference_capture:0},sha));
 assert.throws(()=>applyPhotoPilotReview(before,{...review,data_sha256:'stale'},sha));
});

test('the actual August 2011 reference stays fixed across years, editions and missing observations',()=>{
 const cache=createCoastalImageAlignment(model,photos,sourceReview);
 const ids=new Set(review.profile_ids);
 for(let year=2010;year<=2026;year++)for(const release of [...review.reviewed_releases,26334]){
  const selected=cache.read(year,release).layer.features.filter(f=>ids.has(String(f.id)));
  assert.equal(selected.length,22);
  for(const f of selected){const p=f.properties,t=model.targets.find((t:{id:string})=>t.id===f.id),base=review.corrections.find(c=>c.profile_id===f.id&&c.capture===40)!;
   assert.deepEqual(p.baseline_coordinate,photoCoastCoordinate(t,base.offset_m));assert.equal(p.baseline_year,2011);
   if(p.photo_interpretation){assert.equal(String(p.date_after).slice(0,4),String(year));assert.ok(review.reviewed_releases.includes(release));}
   else {assert.equal(p.photo_review_pending,true);assert.equal(p.delta_m,null);assert.equal(p.scenario_delta_m,null);assert.equal(f.geometry.type,'Point');assert.notEqual(p.trajectory_estimate,true);}
  }
 }
});

test('2013 covers only three profiles; December 2011 cannot silently replace the August baseline',()=>{
 const cache=createCoastalImageAlignment(model,photos,sourceReview),ids=new Set(review.profile_ids);
 const year2013=cache.read(2013,27946).layer.features.filter(f=>ids.has(String(f.id)));
 assert.equal(year2013.filter(f=>f.properties.photo_interpretation).length,3);
 assert.equal(year2013.filter(f=>f.properties.photo_review_pending).length,19);
 const december=cache.read(2011,27946).layer.features.find(f=>f.id==='SC-258-0-33')!;
 assert.equal(december.properties.date_before,'2011-08-01');assert.equal(december.properties.date_after,'2011-12-01');
 assert.equal(december.properties.reference_only,false);assert.equal(december.properties.delta_m,-4.5);
 const baseline=cache.read(2011,11019).layer.features.filter(f=>ids.has(String(f.id)));
 assert.ok(baseline.every(f=>f.properties.reference_only&&f.properties.delta_m===0));
 const after=cache.read(2025,22252).layer.features.find(f=>f.id==='SC-258-0-32')!;
 assert.equal(after.properties.delta_m,-22.5);assert.equal(after.properties.date_before,'2011-08-01');
 const intermediate=cache.read(2019,20753).layer.features.find(f=>f.id==='SC-258-0-32')!;
 assert.equal(intermediate.properties.delta_m,-16);
});

test('the review place offers only source-backed years and the municipal payload matches the global review',()=>{
 const addition=read('lib/generated/progreso-oeste-review-catalogue.json');
 const catalogue=withPhotoPilotCatalogue(read('lib/generated/municipal-photo-refined-catalogue.json') as MunicipalPhotoCatalogue,addition);
 const items=read('public/data/history/esri-local-captures.json').items;
 const options=municipalDatedOptions(items,catalogue,'Progreso',addition.place.coordinates,17,addition.place.coordinates);
 assert.deepEqual(options.map(o=>o.year),[2011,2013,2014,2019,2020,2022,2025]);
 assert.equal(options.find(o=>o.year===2011)!.item.releaseNum,11019);
 const local=read('public/data/municipalities/progreso/photos.json');
 const guided=applyCurrentMunicipalReviews(applyUserShorelineGuides(photos,read(folder+'user-guides-2011-20261105.json'),sha),sha);
 for(const t of local.targets)assert.deepEqual(t,guided.targets.find(x=>x.id===t.id));
 const bytes=readFileSync(new URL('../public/data/municipalities/progreso/photos.json',import.meta.url));
 const index=read('public/data/municipalities/progreso/index.json');
 assert.equal(index.photos.sha256,createHash('sha256').update(bytes).digest('hex'));
 assert.deepEqual(gunzipSync(readFileSync(new URL('../public/data/municipalities/progreso/photos.json.gz',import.meta.url))),bytes);
});

test('the fifteen requested 2011 references move individually and later differences use the refined baseline',()=>{
 const old=[21,21,19.5,28.5,28,28.5,32.5,44,45.5,46,45.5,33,32,29,30,25.5,16.5,13,8,1];
 const requested=new Set([6,7,8,9,10,12,14,15,16,17,18,19,20,21,22]);
 const cache=createCoastalImageAlignment(model,photos,sourceReview);
 for(let n=1;n<=22;n++){
  const id='SC-258-0-'+(29+n),base=review.corrections.find(c=>c.profile_id===id&&c.capture===40)!;
  if(n<=20){if(requested.has(n))assert.notEqual(base.offset_m,old[n-1]);else assert.equal(base.offset_m,old[n-1]);}
  for(const [year,release] of [[2014,18820],[2019,20753],[2020,17825],[2022,25285],[2025,22252]]){
   const reading=review.corrections.find(c=>c.profile_id===id&&c.source==='west-progreso-'+release+'-'+id)!;
   const feature=cache.read(year,release).layer.features.find(f=>f.id===id)!;
   assert.equal(feature.properties.delta_m,reading.offset_m-base.offset_m);
   assert.deepEqual(feature.geometry.type==='LineString'?feature.geometry.coordinates[1]:null,photoCoastCoordinate(model.targets.find((t:{id:string})=>t.id===id),reading.offset_m));
  }
 }
 // A wide connected beach in 2022 was previously interpreted as water.
 assert.equal(cache.read(2022,25285).layer.features.find(f=>f.id==='SC-258-0-49')!.properties.delta_m,36);
});
