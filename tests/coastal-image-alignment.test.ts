import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateCoastalScenario} from '../lib/coastal-scenario.ts';
import {validatePhotoCoast,photoCoastCoordinate,photoCoastBaselineYear,photoCoastPosition} from '../lib/photo-coast.ts';
import {applyPhotoVisualReview} from '../lib/photo-visual-review.ts';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {compatibleSourceLayer,type PhotoSourceReview} from '../lib/photo-source-review.ts';

const read=(path:string)=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const model=validateCoastalScenario(read('public/data/shorelines/scenario/model.json'));
const raw=readFileSync(new URL('../public/data/shorelines/photo-alignment/data.json',import.meta.url));
const originals=validatePhotoCoast(JSON.parse(raw.toString())),sha=createHash('sha256').update(raw).digest('hex');
const review=read('public/data/shorelines/photo-alignment/position-review.json');
const sourceReview=read('public/data/shorelines/photo-alignment/source-position-review.json') as PhotoSourceReview;
const photos=applyPhotoVisualReview(applyPhotoVisualReview(originals,read('public/data/shorelines/photo-alignment/visual-review.json'),sha),review,sha);
const catalogue=read('public/data/history/esri-local-captures.json');
const world=(p:number[],z:number)=>[(p[0]+180)/360*256*2**z,(1-Math.asinh(Math.tan(p[1]*Math.PI/180))/Math.PI)/2*256*2**z];

void test('photographic coordinates reproduce the original local Mercator sampling at every profile and candidate offset',()=>{
 model.targets.forEach((t,i)=>photos.targets[i].readings.forEach(r=>{
  if(r.offset_m===null)return;
  const z=17,pixel=world(t.p,z),q=world(photoCoastCoordinate(t,r.offset_m),z);
  const mpp=156543.03392804097*Math.cos(t.p[1]*Math.PI/180)/2**z;
  assert.ok(Math.abs(q[0]-pixel[0]-t.v[0]*r.offset_m/mpp)<1e-6,t.id+' x');
  assert.ok(Math.abs(q[1]-pixel[1]+t.v[1]*r.offset_m/mpp)<1e-6,t.id+' y');
 }));
});

void test('all 21 new exclusions remove only audited readings and preserve originals and the healthy flagged neighbour',()=>{
 assert.equal(review.exclusions.length,21);
 assert.equal(photos.targets.reduce((n,t,i)=>n+t.readings.filter((r,j)=>r.accepted!==originals.targets[i].readings[j].accepted).length,0),30);
 const healthy=photos.targets.find(t=>t.id==='SC-88-0-249')!.readings.find(r=>r.capture===174)!;
 assert.equal(healthy.accepted,true,'a disagreement is not proof of a bad shoreline');
 photos.targets.forEach((t,i)=>t.readings.forEach((r,j)=>assert.equal(r.offset_m,originals.targets[i].readings[j].offset_m)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),sha);
});

void test('every year keeps the inventory and distinguishes photographic bars from fixed-reference estimates',()=>{
 const cache=createCoastalImageAlignment(model,photos,sourceReview),ids=model.targets.filter(t=>t.type.startsWith('Playa')).map(t=>t.id),index=new Map(model.targets.map((t,i)=>[t.id,i]));
 for(const year of model.years)for(const release of catalogue.items.map((i:{releaseNum:number})=>i.releaseNum)){
  const frame=cache.read(year,release);
  assert.deepEqual(frame.layer.features.map(f=>String(f.id)),ids);
  assert.equal(frame.summary.beachProfiles,3110);assert.equal(frame.summary.structures,493);assert.equal(frame.summary.otherCoasts,753);
  assert.equal(new Set(frame.layer.features.map(f=>f.properties.municipality)).size,13);
  for(const f of frame.layer.features){
   const i=index.get(String(f.id))!,t=model.targets[i],row=photos.targets[i],r=row.readings.find(r=>r.releases.includes(release));
   const expectedModel=t.d.reduce((s,d,j)=>s+(model.years[j]>2010&&model.years[j]<=year?d:0),0);
   assert.equal(f.properties.scenario_original_delta_m,expectedModel);
   if(f.properties.photo_interpretation===true){
    assert.equal(f.geometry.type,'LineString');assert.ok(r?.accepted);
    assert.equal(Number(photos.captures[r!.capture].date.slice(0,4)),year);
    const baseline=photoCoastBaselineYear(photos,row.readings,2010)!;
    assert.ok(baseline===2010||baseline===2011);
    const usable=row.readings.filter(r=>r.accepted&&r.releases.some(release=>!sourceReview.blocked.some(b=>b.release===release&&b.profile_id===t.id)));
    const before=photoCoastPosition(photos,usable,baseline,null)!;
    assert.equal(before.kind,'photo');assert.equal(f.properties.delta_m,baseline===year?0:r!.offset_m!-before.offset);
    if(baseline===year)assert.equal(f.properties.delta_m,0,'the first photograph is a reference, not a change against another capture of the same year');
    if(f.geometry.type==='LineString'){
     assert.deepEqual(f.geometry.coordinates[0],photoCoastCoordinate(t,before.offset));
     assert.deepEqual(f.geometry.coordinates[1],photoCoastCoordinate(t,baseline===year?before.offset:r!.offset_m!));
    }
    assert.equal(f.properties.scenario_unvalidated,false);
   }else{
    assert.equal(f.geometry.type,f.properties.before_reference===true?'Point':'LineString');
    assert.equal(f.properties.trajectory_estimate,true,'a modelled bar must remain explicitly estimated');
    assert.equal(f.properties.baseline_fixed,true);
    assert.equal(f.properties.scenario_unvalidated,true);
    assert.equal(f.properties.spacing_eligible,f.properties.trajectory_reference_kind==='photo');
    if(f.properties.before_reference===true)assert.equal(f.properties.delta_m,null);
    if(f.properties.image_alignment==='spatial_estimate'){
     assert.equal((f.properties.image_alignment_donors as string[]).length,2);
     assert.equal(f.properties.estimated,true);
    }
   }
  }
 }
});

void test('a crossed/unknown source cannot become a photographic bar or supply interpolation',()=>{
 const cache=createCoastalImageAlignment(model,photos,sourceReview);
 assert.equal(sourceReview.data_sha256,sha);
 for(const blocked of sourceReview.blocked){
  const frame=cache.read(2025,blocked.release),f=frame.layer.features.find(f=>f.id===blocked.profile_id);
  assert.ok(f);assert.equal(f.properties.image_alignment,'cartography');assert.equal(f.properties.photo_interpretation,false);assert.equal(f.properties.trajectory_estimate,true);assert.equal(f.properties.context_review,true);
  assert.ok(!frame.layer.features.some(f=>(f.properties.image_alignment_donors as string[])?.includes(blocked.profile_id)),'a source-discrepant reading must not supply neighbours');
  assert.equal(compatibleSourceLayer({type:'FeatureCollection',features:[{...f,properties:{...f.properties,photo_interpretation:true}}]},blocked.release,sourceReview).features.length,blocked.kind==='photo'?0:1);
 }
 assert.throws(()=>createCoastalImageAlignment(model,photos,{...sourceReview,model_sha256:'other model'}));
});

void test('a missing/newly requested raster cannot reuse another edition as a photographic measurement',()=>{
 const cache=createCoastalImageAlignment(model,photos),first=cache.read(2025,26334);
 assert.equal(cache.read(2025,26334),first);
 const unknown=cache.read(2025,null);
 assert.equal(unknown.summary.photoComparisons,0);assert.equal(unknown.summary.photoPositions,0);
 assert.ok(unknown.layer.features.every(f=>f.properties.image_alignment==='cartography'&&f.properties.photo_interpretation===false&&f.properties.trajectory_estimate===true));
 assert.equal(cache.read(2025,26334),first);
 assert.throws(()=>cache.read(2027,26334));
});
