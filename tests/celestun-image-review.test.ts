import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validatePhotoCoast,photoCoastCoordinate,photoCoastDistance} from '../lib/photo-coast.ts';
import {validateCoastalScenario} from '../lib/coastal-scenario.ts';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {applyIntegratedPhotoReviews} from '../lib/integrated-photo-reviews.ts';
import {applyCelestunImageReview} from '../lib/celestun-image-review.ts';
import {applyPhotoVisualReview} from '../lib/photo-visual-review.ts';
import {applyPhotoDigitization} from '../lib/photo-digitization.ts';
import {municipalDatedOptions} from '../lib/coastal-photo-scopes.ts';
const read=(path:string)=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const dir='public/data/shorelines/photo-alignment/';
const raw=readFileSync(new URL('../'+dir+'revised-data.json',import.meta.url));
const sha=createHash('sha256').update(raw).digest('hex');
const review=read('public'+read('lib/generated/celestun-review-version.json').url);
const model=validateCoastalScenario(read('public/data/municipalities/celestun/scenario.json'));
const photos=validatePhotoCoast(read('public/data/municipalities/celestun/photos.json'));
const original=applyPhotoDigitization(applyPhotoVisualReview(validatePhotoCoast(JSON.parse(raw.toString())),read(dir+'revised-visual-review.json'),sha),read(dir+'manual-digitization-20261103.json'),sha);
const originalCelestunReview=applyCelestunImageReview(original,review,sha);
const loadReview=async(url:string,expected:string)=>{const b=readFileSync(new URL('../public'+url,import.meta.url));assert.equal(createHash('sha256').update(b).digest('hex'),expected);return JSON.parse(b.toString());};
type Feature=ReturnType<ReturnType<typeof createCoastalImageAlignment>['read']>['layer']['features'][number];
function assertPendingControl(feature:Feature){
 assert.equal(feature.geometry.type,'Point');assert.equal(feature.properties.photo_review_pending,true);
 assert.equal(feature.properties.photo_interpretation,false);assert.equal(feature.properties.delta_m,null);
 assert.equal(feature.properties.scenario_delta_m,null);assert.equal(feature.properties.estimated,false);
 assert.equal(feature.properties.trajectory_estimate,undefined);
 assert.equal(typeof feature.properties.photo_review_reason,'string');assert(String(feature.properties.photo_review_reason).trim());
 assert(feature.properties.photo_review_method);
}

test('the original Celestun review stays scoped, and the latest shared audit agrees globally and locally',async()=>{
 const next=originalCelestunReview,ids=new Set(photos.targets.map(t=>t.id));
 const current=await applyIntegratedPhotoReviews(original,sha,loadReview);
 assert.equal(review.decisions.length,3256);
 assert.deepEqual(current.targets.filter(t=>ids.has(t.id)),photos.targets);
 for(const t of next.targets.filter(t=>!ids.has(t.id)))assert.deepEqual(t,original.targets.find(x=>x.id===t.id));
 assert.throws(()=>applyCelestunImageReview(original,{...review,data_sha256:'wrong'},sha));
 const bad=structuredClone(review);bad.decisions.find((d:{accepted:boolean})=>d.accepted).source.metadata_checks[0].date='2020-01-01';
 assert.throws(()=>applyCelestunImageReview(original,bad,sha));
 assert.equal(createHash('sha256').update(raw).digest('hex'),'250fa694f9c3829ac0d41598454e28988a6c681fc36c6330c0f950eb08aa76e5');
});
test('the reported town profile uses the interpreted 2011 shore and its real 2025 endpoint, with a fixed origin',()=>{
 const cache=createCoastalImageAlignment(model,photos,read(dir+'revised-source-review.json'));
 const id='SC-30-0-2',target=model.targets.find(t=>t.id===id)!;
 const before=cache.read(2011,27946).layer.features.find(f=>f.id===id)!;
 const after=cache.read(2025,22252).layer.features.find(f=>f.id===id)!;
 assert.equal(before.properties.date_before,'2011-11-23');assert.equal(before.properties.delta_m,0);
 assert.equal(after.properties.date_after,'2025-03-06');assert.equal(after.properties.photo_interpretation,true);
 assert.equal(before.geometry.type,'LineString');assert.equal(after.geometry.type,'LineString');
 if(before.geometry.type!=='LineString'||after.geometry.type!=='LineString')throw Error('Missing shoreline');
 assert.deepEqual(before.geometry.coordinates[0],photoCoastCoordinate(target,-59));
 assert.deepEqual(after.geometry.coordinates[0],before.geometry.coordinates[0]);
 assert.deepEqual(after.geometry.coordinates[1],photoCoastCoordinate(target,-13));
 assert(Math.abs(Number(after.properties.delta_m)-46)<.2);
});
test('native context corrections follow the outer sandy shore, rather than buildings, an inner bank or a breakwater',()=>{
 const offset=(id:string,date:string)=>{
  const t=photos.targets.find(t=>t.id===id)!;
  return t.readings.find(r=>photos.captures[r.capture].date===date)!;
 };
 assert.equal(offset('SC-6-0-2','2011-11-23').offset_m,9);
 assert.equal(offset('SC-6-0-1','2016-03-07').offset_m,63);
 assert.equal(offset('SC-4-0-527','2016-03-07').offset_m,-22);
 assert.equal(offset('SC-30-0-0','2024-01-05').offset_m,4);
 // Original ambiguity is preserved in its dated revision; any later recovery
 // must be enumerated by the shared audit, not silently accepted by this test.
 assert(originalCelestunReview.targets.find(t=>t.id==='SC-3-0-0')!.readings.every(r=>!r.accepted));
 const audit=read('lib/generated/coastal-audit-20261109.json');
 for(const reading of photos.targets.find(t=>t.id==='SC-3-0-0')!.readings.filter(r=>r.accepted)){
  const decision=audit.decisions.find((d:{profileId:string;capture:number})=>d.profileId==='SC-3-0-0'&&d.capture===reading.capture);
  assert(decision?.newAccepted);assert.equal(reading.offset_m,decision.newOffset);
  assert.equal(photos.captures[reading.capture].date,decision.date);assert(decision.evidence.length>0);
 }
 assert.equal(review.revision,2);
 assert.equal(review.supersedes_sha256,createHash('sha256').update(readFileSync(new URL('../'+dir+'celestun-image-review-20261105.json',import.meta.url))).digest('hex'));
 for(const d of review.decisions.filter((d:{accepted:boolean})=>d.accepted)){
  assert.equal(d.source.zoom,17);
  assert(d.verified_releases.includes(d.source.release));
 }
});
test('every offered Celestun year is a capture at that local profile; a 2012 photo cannot stand in for 2011',()=>{
 const catalogue=read('lib/generated/municipal-photo-refined-catalogue.json'),items=read('public/data/history/esri-local-captures.json').items;
 const cache=createCoastalImageAlignment(model,photos,read(dir+'revised-source-review.json'));
 for(const id of ['SC-30-0-2','SC-4-0-200','SC-4-0-366','SC-4-0-526']){
  const target=model.targets.find(t=>t.id===id)!;
  const options=municipalDatedOptions(items,catalogue,'Celestún',target.p,17,target.p);
  for(const o of options){
   assert.equal(Number(o.date.slice(0,4)),o.year);
   const f=cache.read(o.year,o.item.releaseNum).layer.features.find(f=>f.id===id);
   assert(f,id+' '+o.year+' missing its reviewed observation');
   assert.equal(String(f.properties.date_after).slice(0,4),String(o.year));
  }
 }
 const target=model.targets.find(t=>t.id==='SC-30-0-2')!;
 assert.equal(municipalDatedOptions(items,catalogue,'Celestún',target.p,17,target.p).find(o=>o.year===2011)?.date,'2011-11-23');
});
test('all displayed years use same-year interpreted photo pairs or explicit pending controls without simulated metres',()=>{
 const cache=createCoastalImageAlignment(model,photos,read(dir+'revised-source-review.json')),fixed=new Map();
 for(const year of model.years)for(const release of read('public/data/history/esri-local-captures.json').items.map((i:{releaseNum:number})=>i.releaseNum))for(const f of cache.read(year,release).layer.features){
  if(f.properties.photo_review_pending){assertPendingControl(f);continue;}
  assert.equal(f.properties.photo_interpretation,true);assert.equal(f.properties.trajectory_estimate,undefined);
  assert.equal(String(f.properties.date_after).slice(0,4),String(year));
  const row=photos.targets.find(t=>t.id===f.id)!,target=model.targets.find(t=>t.id===f.id)!;
  const baseline=[...row.readings.filter(r=>r.accepted)].sort((a,b)=>photos.captures[a.capture].date.localeCompare(photos.captures[b.capture].date))[0];
  const endpoint=row.readings.find(r=>r.releases.includes(release))!;
  assert(endpoint.accepted);assert.equal(f.properties.date_before,photos.captures[baseline.capture].date);
  assert.equal(f.properties.date_after,photos.captures[endpoint.capture].date);assert.equal(f.geometry.type,'LineString');
  if(f.geometry.type!=='LineString')throw Error('Missing photo pair');
  assert.deepEqual(f.geometry.coordinates,[photoCoastCoordinate(target,baseline.offset_m!),photoCoastCoordinate(target,endpoint.offset_m!)]);
  assert(Math.abs(Math.abs(Number(f.properties.delta_m))-photoCoastDistance(f.geometry.coordinates[0] as [number,number],f.geometry.coordinates[1] as [number,number]))<1e-8);
  if(!fixed.has(f.id))fixed.set(f.id,f.properties.baseline_coordinate);else assert.deepEqual(f.properties.baseline_coordinate,fixed.get(f.id));
 }
});
test('short-axis distances agree with independent PROJ WGS84 inverse geodesics to under one centimetre',()=>{
 for(const f of read('tests/fixtures/celestun-wgs84-geodesics.json'))assert(Math.abs(photoCoastDistance(f.a,f.b)-f.distance_m)<.01,f.id);
});
