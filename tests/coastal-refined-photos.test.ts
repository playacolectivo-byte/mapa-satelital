import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateCoastalScenario} from '../lib/coastal-scenario.ts';
import {validatePhotoCoast,photoCoastBaselineYear,photoCoastPosition,photoCoastCoordinate} from '../lib/photo-coast.ts';
import {applyPhotoVisualReview} from '../lib/photo-visual-review.ts';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {municipalDatedOptions,municipalComparisonOptions} from '../lib/coastal-photo-scopes.ts';
import type {WaybackItem} from '@esri/wayback-core';

const read=(p:string)=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const model=validateCoastalScenario(read('public/data/shorelines/scenario/model.json'));
const bytes=readFileSync(new URL('../public/data/shorelines/photo-alignment/revised-data.json',import.meta.url));
const sha=createHash('sha256').update(bytes).digest('hex'),raw=validatePhotoCoast(JSON.parse(bytes.toString()));
const review=read('public/data/shorelines/photo-alignment/revised-visual-review.json');
const sources=read('public/data/shorelines/photo-alignment/revised-source-review.json');
const photos=applyPhotoVisualReview(raw,review,sha),catalogue=read('lib/generated/municipal-photo-refined-catalogue.json');
const items=read('public/data/history/esri-local-captures.json').items as WaybackItem[];

void test('the separate image interpretation preserves the original inventory and binds every review to its data',()=>{
 assert.equal(sha,read('lib/generated/photo-coast-revised-version.json').sha256);
 assert.equal(sha,sources.data_sha256);assert.equal(sha,catalogue.photo_sha256);
 assert.equal(raw.targets.length,4356);assert.equal(raw.targets.reduce((n,t)=>n+t.readings.length,0),36042);
 assert.equal(review.exclusions.length,95);
 assert.deepEqual(raw.targets.map(t=>t.id),model.targets.map(t=>t.id));
 assert.equal(photos.targets.reduce((n,t)=>n+t.readings.filter(r=>r.accepted).length,0),14858);
 assert.equal(createHash('sha256').update(readFileSync(new URL('../public/data/shorelines/scenario/model.json',import.meta.url))).digest('hex'),'21ed574a9c464cab785197f95568e242da2358cae23b08a420afde98aa294513');
});

void test('all 17 years and 22 editions keep photographic endpoints separate from explicit estimated trajectories',()=>{
 const cache=createCoastalImageAlignment(model,photos,sources),index=new Map(model.targets.map((t,i)=>[t.id,i]));
 for(const item of items)for(const year of model.years){
  const frame=cache.read(year,item.releaseNum);assert.equal(frame.layer.features.length,3110);
  for(const f of frame.layer.features){
   const i=index.get(String(f.id))!,t=model.targets[i],row=photos.targets[i];
   assert.ok(t.type.startsWith('Playa'));
   if(f.properties.photo_interpretation===true){
    const r=row.readings.find(r=>r.releases.includes(item.releaseNum))!;
    const usable=row.readings.filter(r=>r.accepted&&r.releases.some(release=>!sources.blocked.some((s:{release:number;profile_id:string})=>s.release===release&&s.profile_id===t.id)));
    const b=photoCoastBaselineYear(photos,usable)!;
    const a=photoCoastPosition(photos,usable,b,null)!;
    assert.ok(r.accepted);assert.equal(Number(photos.captures[r.capture].date.slice(0,4)),year);
    const end=b===year?a.offset:r.offset_m!;
    assert.equal(f.properties.delta_m,end-a.offset);
    assert.deepEqual(f.geometry,{type:'LineString',coordinates:[photoCoastCoordinate(t,a.offset),photoCoastCoordinate(t,end)]});
    if(b===year)assert.equal(f.properties.delta_m,0);
   }else{
    assert.equal(f.geometry.type,f.properties.before_reference===true?'Point':'LineString');
    assert.equal(f.properties.trajectory_estimate,true);
    assert.equal(f.properties.estimated,true);
    assert.equal(f.properties.scenario_unvalidated,true);
    assert.equal(f.properties.baseline_fixed,true);
   }
  }
 }
});

void test('the photographed and estimated calendars stay fixed to all 31 scopes, independently of the camera',()=>{
 for(const a of catalogue.anchors){
  const dated=municipalDatedOptions(items,catalogue,a.municipality,a.coordinates,17,a.coordinates);
  assert.ok(dated.length,a.municipality);
  const away=municipalDatedOptions(items,catalogue,a.municipality,[-90.4,20.9],11,a.coordinates);
  assert.deepEqual(dated.map(o=>[o.year,o.item.releaseNum]),away.map(o=>[o.year,o.item.releaseNum]));
  for(const o of municipalComparisonOptions(items,catalogue,a.municipality,a.coordinates,17,a.coordinates))assert.ok(dated.some(d=>d.year===o.year));
  for(const o of dated)assert.ok(a.captures.some((c:{year:number;releases:number[]})=>c.year===o.year&&c.releases.includes(o.item.releaseNum)));
 }
});
