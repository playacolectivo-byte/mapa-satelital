import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {municipalProfileAllowed} from '../lib/municipal-pages.ts';
import {validatePhotoCoast,photoCoastCoordinate,photoCoastDistance} from '../lib/photo-coast.ts';
import {validateCoastalScenario} from '../lib/coastal-scenario.ts';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {applyIntegratedPhotoReviews} from '../lib/integrated-photo-reviews.ts';
import {applyDatedImageReview} from '../lib/dated-image-review.ts';
import {datedImageReviews} from '../lib/dated-image-reviews.ts';
import {applyPhotoVisualReview} from '../lib/photo-visual-review.ts';
import {applyPhotoDigitization} from '../lib/photo-digitization.ts';
import {municipalDatedOptions} from '../lib/coastal-photo-scopes.ts';
const read=(p:string)=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const bytes=(p:string)=>readFileSync(new URL('../'+p,import.meta.url));
const dir='public/data/shorelines/photo-alignment/';
const raw=bytes(dir+'revised-data.json'),sha=createHash('sha256').update(raw).digest('hex');
const version=datedImageReviews.find(r=>r.municipality==='Ixil')!;
const review=read('public'+version.url);
const previousReview=read(dir+'ixil-image-review-20261108-r5.json');
const ixil2015=read(dir+'ixil-revision-orilla-2015-20261113.json');
type Ixil2015Row={id:string;capture:number;status:'retained'|'adjusted'|'withdrawn'|'pending';old_offset_m:number|null;new_offset_m:number|null;tile_zoom:number;tiles:Record<string,{sha256:string}[]>};
const ixil2015Rows=ixil2015.rows as Ixil2015Row[];
const ixil2015FollowUp=read(dir+'coastal-audit-ixil-captura-2015-20261116.json');
const ixil2015FollowUpById=new Map<string,{capture:number;oldOffset:number|null;newOffset:number;date:string}>(ixil2015FollowUp.decisions.map((d:{profileId:string})=>[d.profileId,d]));
const photos=validatePhotoCoast(read('public/data/municipalities/ixil/photos.json'));
const model=validateCoastalScenario(read('public/data/municipalities/ixil/scenario.json'));
const sources=read(dir+'revised-source-review.json');
const items=read('public/data/history/esri-local-captures.json').items;
const catalogue=read('lib/generated/municipal-photo-refined-catalogue.json');
const initial=applyPhotoDigitization(applyPhotoVisualReview(validatePhotoCoast(JSON.parse(raw.toString())),read(dir+'revised-visual-review.json'),sha),read(dir+'manual-digitization-20261103.json'),sha);
const celestunVersion=datedImageReviews.find(r=>r.municipality==='Celestún')!;
const beforeIxil=applyDatedImageReview(initial,read('public'+celestunVersion.url),sha,celestunVersion);
const originalIxilReview=applyDatedImageReview(beforeIxil,review,sha,version);
const originalIxilPhotos={...originalIxilReview,targets:originalIxilReview.targets.filter(t=>model.targets.some(p=>p.id===t.id))};
const loadReview=async(url:string,expected:string)=>{const b=bytes('public'+url);assert.equal(createHash('sha256').update(b).digest('hex'),expected);return JSON.parse(b.toString());};
type Feature=ReturnType<ReturnType<typeof createCoastalImageAlignment>['read']>['layer']['features'][number];
function assertPendingControl(feature:Feature){
 assert.equal(feature.geometry.type,'Point');
 assert.equal(feature.properties.photo_review_pending,true);
 assert.equal(feature.properties.photo_interpretation,false);
 assert.equal(feature.properties.delta_m,null);
 assert.equal(feature.properties.scenario_delta_m,null);
 assert.equal(feature.properties.estimated,false);
 assert.equal(feature.properties.trajectory_estimate,undefined);
 assert.equal(typeof feature.properties.photo_review_reason,'string');
 assert(String(feature.properties.photo_review_reason).trim());
 assert(feature.properties.photo_review_method);
}

test('the 1030 original corridor decisions stay scoped, and the latest shared audit agrees globally and locally',async()=>{
 const old=beforeIxil,next=originalIxilReview,ids=new Set(photos.targets.map(t=>t.id));
 const current=await applyIntegratedPhotoReviews(initial,sha,loadReview);
 assert.equal(review.decisions.length,1030);assert.equal(ids.size,142);
 assert.deepEqual(current.targets.filter(t=>ids.has(t.id)),photos.targets);
 assert.deepEqual(next.targets.filter(t=>!ids.has(t.id)),old.targets.filter(t=>!ids.has(t.id)));
 assert.equal(sha,'250fa694f9c3829ac0d41598454e28988a6c681fc36c6330c0f950eb08aa76e5');
 assert.equal(createHash('sha256').update(bytes('public'+version.url)).digest('hex'),version.sha256);
 assert.deepEqual(gunzipSync(bytes('public'+version.url+'.gz')),bytes('public'+version.url));
 const index=read('public/data/municipalities/ixil/index.json');
 assert.equal(createHash('sha256').update(bytes('public/data/municipalities/ixil/photos.json')).digest('hex'),index.photos.sha256);
 assert.throws(()=>applyDatedImageReview(old,{...review,municipality:'Other'},sha,version));
 const invalid=structuredClone(review);invalid.decisions.find((d:{accepted:boolean})=>d.accepted).source.metadata_checks[0].date='2020-01-01';
 assert.throws(()=>applyDatedImageReview(old,invalid,sha,version));
});
test('current dates and editions draw accepted positions from a fixed readable reference, or explicit pending controls without metres',()=>{
 const cache=createCoastalImageAlignment(model,photos,sources),origins=new Map();
 for(const year of model.years)for(const item of items){
  const frame=cache.read(year,item.releaseNum);
  for(const f of frame.layer.features){
   if(f.properties.photo_review_pending){assertPendingControl(f);continue;}
   assert.equal(f.properties.photo_interpretation,true);assert.equal(f.properties.trajectory_estimate,undefined);
   const dates=photos.targets.find(t=>t.id===f.id)!.readings.filter(r=>r.accepted).map(r=>photos.captures[r.capture].date).sort();assert.equal(f.properties.date_before,dates[0]);assert.equal(String(f.properties.date_after).slice(0,4),String(year));
   const t=model.targets.find(t=>t.id===f.id)!;
   const r=photos.targets.find(t=>t.id===f.id)!.readings.find(r=>r.releases.includes(item.releaseNum))!;
   const base=photos.targets.find(t=>t.id===f.id)!.readings.filter(r=>r.accepted).sort((a,b)=>photos.captures[a.capture].date.localeCompare(photos.captures[b.capture].date))[0];
   assert(r.accepted);assert.equal(f.geometry.type,'LineString');
   if(f.geometry.type!=='LineString')throw Error('Missing line');
   assert.deepEqual(f.geometry.coordinates,[photoCoastCoordinate(t,base.offset_m!),photoCoastCoordinate(t,r.offset_m!)]);
   if(origins.has(f.id))assert.deepEqual(origins.get(f.id),f.geometry.coordinates[0]);else origins.set(f.id,f.geometry.coordinates[0]);
   assert(Math.abs(Math.abs(Number(f.properties.delta_m))-photoCoastDistance(f.geometry.coordinates[0] as [number,number],f.geometry.coordinates[1] as [number,number]))<1e-8);
  }
 }
 assert.equal(origins.size,142);
});
test('every offered local year has a real compatible result and does not change the map location',()=>{
 const cache=createCoastalImageAlignment(model,photos,sources);
 for(const t of model.targets){
  const options=municipalDatedOptions(items,catalogue,'Ixil',t.p,17,t.p);
  assert(options.some(o=>o.year===2012));assert(options.some(o=>o.year===2025));
  for(const o of options){const f=cache.read(o.year,o.item.releaseNum).layer.features.find(f=>f.id===t.id);assert(f,t.id+' '+o.year);assert.equal(f.properties.date_after,o.date);}
 }
 const west=model.targets[0],east=model.targets.find(t=>t.id==='SC-88-0-163')!;
 assert(municipalDatedOptions(items,catalogue,'Ixil',west.p,17,west.p).some(o=>o.year===2023));
 assert(!municipalDatedOptions(items,catalogue,'Ixil',east.p,17,east.p).some(o=>o.year===2023));
});
test('the dated Ixil review retains the accepted and rejected decisions before the subsequent shared audit',()=>{
 const cache=createCoastalImageAlignment(model,originalIxilPhotos,sources);
 const accepted=(d:{accepted:boolean})=>d.accepted;
 assert.equal(review.decisions.filter(accepted).length,previousReview.decisions.filter(accepted).length-ixil2015.withdrawn);
 for(const d of review.decisions){
  const f=cache.read(Number(d.date.slice(0,4)),d.source.release).layer.features.find(f=>f.id===d.profile_id);
  if(!d.accepted)assert.equal(f,undefined);else{assert(f);assert.equal(d.source.zoom,17);assert.equal(d.source.metadata_checks.length,3);assert(d.source.metadata_checks.every((c:{date:string})=>c.date===d.date));}
 }
 assert.equal(cache.read(2011,11019).layer.features.length,116);
 assert.equal(cache.read(2015,10768).layer.features.length,ixil2015.retained+ixil2015.adjusted);
 assert.equal(cache.read(2015,18820).layer.features.length,ixil2015.retained);
 assert.equal(cache.read(2025,26334).layer.features.length,140);
 const changed=structuredClone(model);for(const t of changed.targets)t.d=t.d.map(n=>n+100);
 const positions=(layer:ReturnType<typeof cache.read>['layer'])=>layer.features.map(f=>({id:f.id,geometry:f.geometry,delta:f.properties.delta_m}));
 assert.deepEqual(positions(createCoastalImageAlignment(changed,originalIxilPhotos,sources).read(2025,26334).layer),positions(cache.read(2025,26334).layer));
});
test('Ixil local metre conversion agrees with independent WGS84 inverse geodesics',()=>{
 for(const fixture of read('tests/fixtures/ixil-wgs84-geodesics.json'))assert(Math.abs(photoCoastDistance(fixture.a,fixture.b)-fixture.distance_m)<.01,fixture.id);
});
test('the visible corridor includes both missing flanks, preserves ownership and never imports the full coastline',()=>{
 const scope=read('public/data/municipalities/ixil/index.json');
 assert.equal(scope.reviewed_context.profile_ids.length,106);
 assert.equal(model.targets.filter(t=>t.m==='Ixil').length,36);
 assert(model.targets.every(t=>municipalProfileAllowed(scope,t)));
 assert(!municipalProfileAllowed(scope,{id:'not-reviewed',m:'Progreso'}));
 assert(!municipalProfileAllowed(scope,{id:scope.reviewed_context.profile_ids[0],m:'Tizimín'}));
 const frame=createCoastalImageAlignment(model,photos,sources).read(2025,26334);
 assert.equal(frame.layer.features.length,139);
 for(const id of ['SC-88-0-80','SC-88-0-125','SC-88-0-164','SC-88-0-179','SC-88-0-209','SC-88-0-215']){
  const f=frame.layer.features.find(f=>f.id===id)!;assert(f,id);
  const t=model.targets.find(t=>t.id===id)!;
  assert.equal(f.properties.municipality,t.m);
  const d=review.decisions.find((d:{profile_id:string;date:string})=>d.profile_id===id&&d.date===f.properties.date_after);
  assert.deepEqual(f.geometry.type==='LineString'&&f.geometry.coordinates[1],photoCoastCoordinate(t,d.offset_m));
 }
 const previous=read('public/data/shorelines/photo-alignment/ixil-image-review-20261106-r2.json');
 const previousKeys=previous.decisions.map((d:{profile_id:string;capture:number})=>d.profile_id+':'+d.capture);
 assert.deepEqual(review.decisions.map((d:{profile_id:string;capture:number})=>d.profile_id+':'+d.capture),previousKeys);
 for(const id of ['SC-88-0-81','SC-88-0-111','SC-88-0-112']){
  assert(!frame.layer.features.some(f=>f.id===id));
  const target=model.targets.find(t=>t.id===id)!;
  const date=municipalDatedOptions(items,catalogue,'Ixil',target.p,17,target.p).find(o=>o.year===2025)!;
  assert.equal(date.date,'2025-03-13');
 }
 for(const d of review.decisions)if(d.accepted)for(const release of d.verified_releases){
  assert(d.source.edition_checks.some((check:{release:number;dates:string[];raster_check?:{compatible:boolean};points?:{delta_m:number;footprint:{date:string;sensor:string;sha256:string}}[]})=>{
   if(check.release!==release||check.dates.length!==3||check.dates.some(date=>date!==d.date))return false;
   if(check.raster_check?.compatible)return true;
   return check.points?.map(p=>p.delta_m).join(',')==='-3,0,3'&&check.points.every(p=>p.footprint.date===d.date&&p.footprint.sensor===photos.captures[d.capture].source&&/^[a-f0-9]{64}$/.test(p.footprint.sha256));
  }));
 }
});

test('the 16 February 2015 decision ledger matches both editions, the local selector and the displayed geometry',()=>{
 const cache=createCoastalImageAlignment(model,photos,sources);
 const main=new Map(cache.read(2015,10768,17).layer.features.map(f=>[f.id,f]));
 const alternate=new Map(cache.read(2015,18820,17).layer.features.map(f=>[f.id,f]));
 const prior=new Map<string,{accepted:boolean;offset_m:number|null}>(previousReview.decisions.filter((d:{date:string})=>d.date===ixil2015.date).map((d:{profile_id:string;accepted:boolean;offset_m:number|null})=>[d.profile_id,d]));
 const decisions=new Map<string,{accepted:boolean;offset_m:number|null;verified_releases:number[]}>(review.decisions.filter((d:{date:string})=>d.date===ixil2015.date).map((d:{profile_id:string;accepted:boolean;offset_m:number|null;verified_releases:number[]})=>[d.profile_id,d]));
 assert.equal(ixil2015Rows.length,photos.targets.length);
 assert.equal(new Set(ixil2015Rows.map(row=>row.id)).size,ixil2015Rows.length);
 for(const status of ['retained','adjusted','withdrawn','pending'] as const)assert.equal(ixil2015Rows.filter(row=>row.status===status).length,ixil2015[status]);
 for(const row of ixil2015Rows){
  const old=prior.get(row.id)!;
  const decision=decisions.get(row.id)!;
  const target=model.targets.find(t=>t.id===row.id)!;
  const current=photos.targets.find(t=>t.id===row.id)!.readings.find(r=>r.capture===row.capture)!;
  assert.equal(row.tile_zoom,17);
  assert.equal(old.offset_m,row.old_offset_m,row.id);
  const followUp=ixil2015FollowUpById.get(row.id);
  if(followUp?.capture===row.capture){
   assert.equal(followUp.date,ixil2015.date,row.id);
   assert.equal(followUp.oldOffset,row.new_offset_m,row.id);
   assert.equal(current.accepted,true,row.id);
   assert.equal(current.offset_m,followUp.newOffset,row.id);
   assert.deepEqual(current.releases,[10768,18820],row.id);
   const endpoint=photoCoastCoordinate(target,followUp.newOffset);
   for(const feature of [main.get(row.id),alternate.get(row.id)]){
    assert(feature?.geometry.type==='LineString',row.id);
    assert.equal(feature.properties.date_after,ixil2015.date,row.id);
    assert.deepEqual(feature.geometry.coordinates[1],endpoint,row.id);
   }
   continue;
  }
  assert.equal(current.offset_m,row.new_offset_m,row.id);
  assert.equal(current.accepted,decision.accepted,row.id);
  const selected=municipalDatedOptions(items,catalogue,'Ixil',target.p,17,target.p).find(o=>o.year===2015);
  if(!decision.accepted){
   assert.equal(row.new_offset_m,null,row.id);
   for(const feature of [main.get(row.id),alternate.get(row.id)])if(feature)assertPendingControl(feature);
   if(row.status==='withdrawn')assert(old.accepted,row.id);
   if(row.status==='pending')assert(!old.accepted,row.id);
   continue;
  }
  assert(selected,row.id);
  assert.equal(selected.date,ixil2015.date,row.id);
  assert.equal(selected.item.releaseNum,10768,row.id);
  const feature=main.get(row.id)!;
  assert(feature.geometry.type==='LineString',row.id);
  assert.equal(feature.properties.date_after,ixil2015.date,row.id);
  assert.deepEqual(feature.geometry.coordinates[1],photoCoastCoordinate(target,row.new_offset_m!),row.id);
  assert(row.tiles['10768'].length,row.id);
  if(row.status==='adjusted'){
   assert.notEqual(row.old_offset_m,row.new_offset_m,row.id);
   assert.deepEqual(decision.verified_releases,[10768],row.id);
   const fallback=alternate.get(row.id);
   if(fallback)assertPendingControl(fallback);
  }else{
   assert.equal(row.old_offset_m,row.new_offset_m,row.id);
   const fallback=alternate.get(row.id);
   assert.deepEqual(fallback?.geometry,feature.geometry,row.id);
  }
 }
 assert.deepEqual(review.decisions.filter((d:{date:string})=>d.date!==ixil2015.date),previousReview.decisions.filter((d:{date:string})=>d.date!==ixil2015.date));
});

test('detail positions use their verified edition, and enlarged general-level positions retain explicit pending-HD provenance',()=>{
 const cache=createCoastalImageAlignment(model,photos,sources);
 const expected=new Map<string,number>();
 for(const decision of review.decisions){
  for(const [release,offset] of decision.detail_offsets){
   expected.set(decision.profile_id+':'+decision.date+':'+release,offset);
   const checked=decision.source.detail_checks.find((c:{release:number})=>c.release===release);
   assert(checked?.dates.every((date:string)=>date===decision.date));
   assert.match(checked.tile_sha256,/^[a-f0-9]{64}$/);
  }
 }
 assert.equal(expected.size,1128); // Frozen inventory from the original dated review.
 const seen=new Set<string>();let fallbackCount=0,pendingCount=0;
 for(const year of model.years)for(const item of items){
  const base=cache.read(year,item.releaseNum,17),detail=cache.read(year,item.releaseNum,18);
  for(const feature of detail.layer.features){
   if(feature.properties.photo_review_pending){assertPendingControl(feature);pendingCount++;continue;}
   assert.equal(feature.properties.photo_interpretation,true);
   const key=feature.id+':'+feature.properties.date_after+':'+item.releaseNum;
   const target=model.targets.find(t=>t.id===feature.id)!;
   const reading=photos.targets.find(t=>t.id===feature.id)!.readings.find(r=>r.releases.includes(item.releaseNum))!;
   const coarse=base.layer.features.find(f=>f.id===feature.id)!;
   assert(reading.accepted);
   assert.equal(photos.captures[reading.capture].date,feature.properties.date_after);
   assert(feature.geometry.type==='LineString'&&coarse.geometry.type==='LineString');
   assert.deepEqual(feature.geometry.coordinates[0],coarse.geometry.coordinates[0]);
   const detailOffset=reading.detail_offsets?.find(([release])=>release===item.releaseNum)?.[1];
   if(detailOffset===undefined){
    assert.equal(feature.properties.photo_detail_review_pending,true);
    assert.equal(feature.properties.photo_review_tile_zoom,17);
    assert.deepEqual(feature.geometry,coarse.geometry);fallbackCount++;
   }else{
    assert.equal(detailOffset,expected.get(key),key);
    assert.equal(feature.properties.photo_detail_review_pending,undefined);
    const endpoint=feature.properties.reference_only?coarse.geometry.coordinates[0]:photoCoastCoordinate(target,detailOffset);
    assert.deepEqual(feature.geometry.coordinates[1],endpoint);seen.add(key);
   }
   assert(Math.abs(Math.abs(Number(feature.properties.delta_m))-photoCoastDistance(feature.geometry.coordinates[0] as [number,number],feature.geometry.coordinates[1] as [number,number]))<1e-8);
  }
 }
 assert(fallbackCount>0);assert(pendingCount>0);
 for(const row of photos.targets)for(const reading of row.readings)if(reading.accepted)for(const [release] of reading.detail_offsets??[])assert(seen.has(row.id+':'+photos.captures[reading.capture].date+':'+release));
 for(const [year,release,profile,offset] of [[2022,25982,115,0],[2022,25982,116,-1.5],[2022,25982,117,-2],[2022,25982,119,0.5],[2022,25982,120,-3.5],[2022,25982,121,-4.5],[2022,25982,122,-5.5],[2022,25982,123,-3.5],[2022,25982,165,5],[2022,25982,166,-3.5],[2022,25982,167,-4.5],[2022,25982,168,-2],[2022,25982,174,2],[2025,26334,122,2],[2025,26334,125,-16.5],[2025,26334,126,-7]]){
  const id='SC-88-0-'+profile;
  const feature=cache.read(year,release,18).layer.features.find(f=>f.id===id)!;
  assert(feature.geometry.type==='LineString',id);
  assert.deepEqual(feature.geometry.coordinates[1],photoCoastCoordinate(model.targets.find(t=>t.id===id)!,offset));
 }
 for(const [year,release,zoom] of [[2015,18820,18],[2022,25982,19]]){
  const enlarged=cache.read(year,release,zoom);assert(enlarged.layer.features.length>0);
  for(const f of enlarged.layer.features)if(f.properties.photo_review_pending)assertPendingControl(f);else{assert.equal(f.properties.photo_detail_review_pending,true);assert.equal(f.properties.photo_review_tile_zoom,17);assert.deepEqual(f.geometry,cache.read(year,release,17).layer.features.find(c=>c.id===f.id)!.geometry);}
 }
});


test('both March 2022 captures are audited profile by profile and other dates stay byte-equivalent',()=>{
 const previous=read(dir+'ixil-image-review-20261108-r4.json');
 const selected=(d:{date:string})=>d.date==='2022-03-03'||d.date==='2022-03-31';
 assert.deepEqual(previousReview.decisions.filter((d:{date:string})=>!selected(d)),previous.decisions.filter((d:{date:string})=>!selected(d)));
 const focus=review.decisions.filter(selected);
 assert.equal(focus.length,142);
 assert.equal(new Set(focus.map((d:{profile_id:string})=>d.profile_id)).size,142);
 for(const [date,profiles] of [['2022-03-03',63],['2022-03-31',79]] as const){
  const rows=focus.filter((d:{date:string})=>d.date===date);
  assert.equal(rows.length,profiles);
  for(const d of rows){
   assert(d.accepted);
   assert.equal(d.fourth_pass.source_level,18);
   assert(d.fourth_pass.cross_level_check.compatible);
   assert(d.fourth_pass.visual_evidence);
   assert(d.source.detail_checks.every((c:{dates:string[]})=>c.dates.every(date=>date===d.date)));
  }
 }
});
