import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateCoastalScenario} from '../lib/coastal-scenario.ts';
import {validatePhotoCoast,photoCoastComparison,photoCoastBaselineYear,compatiblePhotoCoastLayer} from '../lib/photo-coast.ts';
import {municipalComparisonOptions} from '../lib/coastal-photo-scopes.ts';
const modelPath=new URL('../public/data/shorelines/scenario/model.json',import.meta.url);
const model=validateCoastalScenario(JSON.parse(readFileSync(modelPath,'utf8')));
const data=validatePhotoCoast(JSON.parse(readFileSync(new URL('../public/data/shorelines/photo-alignment/data.json',import.meta.url),'utf8')));

test('all 4356 IDs and 13 municipalities were reviewed, including rejections',()=>{
 assert.equal(data.model_sha256,createHash('sha256').update(readFileSync(modelPath)).digest('hex'));
 assert.equal(data.targets.length,4356);assert.equal(new Set(model.targets.map(t=>t.m)).size,13);
 assert.deepEqual(data.targets.map(t=>t.id),model.targets.map(t=>t.id));
 assert.equal(data.targets.reduce((sum,t)=>sum+t.readings.length,0),36042);
 assert.equal(data.targets.reduce((sum,t)=>sum+t.readings.filter(r=>r.accepted).length,0),10473);
 assert.ok(data.targets.some(t=>!t.readings.some(r=>r.accepted)),'unknowns must remain explicit');
});

test('every calendar year retains the full audit and never invents numbers for incompatible photos',()=>{
 for(let year=2010;year<=2026;year++){
  const layer=photoCoastComparison(model,data,2010,year,26334);
  assert.equal(layer.features.length,4356);assert.equal(new Set(layer.features.map(f=>f.properties.municipality)).size,13);
  for(const f of layer.features){
   assert.equal(f.properties.photo_interpretation,true);assert.equal(f.properties.scenario_unvalidated,false);
   if(f.properties.photo_mismatch||!f.properties.photo_location_matched)assert.equal(f.properties.delta_m,null);
   if(typeof f.properties.delta_m==='number')assert.equal(Number(String(f.properties.photo_date).slice(0,4)),year);
   if(f.geometry.type!=='LineString')assert.fail();
   assert.ok(f.geometry.coordinates.every(p=>p.every(Number.isFinite)));
  }
 }
});

test('an accepted exact photo endpoint reproduces the independently extracted offset',()=>{
 const layer=photoCoastComparison(model,data,2010,2011,11019);
 let checked=0;
 layer.features.forEach((f,i)=>{
  if(!f.properties.photo_location_matched)return;
  const r=data.targets[i].readings.find(r=>r.accepted&&r.releases.includes(11019))!;
  const t=model.targets[i];
  if(f.geometry.type!=='LineString')assert.fail();
  const q=f.geometry.coordinates.at(-1)!;
  // Compare to the independently specified Web-Mercator sampling plane.
  const world=(p:number[])=>[(p[0]+180)/360*256*2**17,(1-Math.asinh(Math.tan(p[1]*Math.PI/180))/Math.PI)/2*256*2**17];
  const a=world(t.p),b=world(q),mpp=156543.03392804097*Math.cos(t.p[1]*Math.PI/180)/2**17;
  assert.ok(Math.abs(b[0]-a[0]-t.v[0]*r.offset_m!/mpp)<1e-6);
  assert.ok(Math.abs(b[1]-a[1]+t.v[1]*r.offset_m!/mpp)<1e-6);checked++;
 });
 assert.ok(checked>100);
});
test('every point uses an actual 2010 reference, else actual 2011, else no reference',()=>{
 const layer=photoCoastComparison(model,data,2010,2025,26334);let fallback=0;
 data.targets.forEach((t,i)=>{
  const years=new Set(t.readings.filter(r=>r.accepted).map(r=>Number(data.captures[r.capture].date.slice(0,4))));
  const expected=years.has(2010)?2010:years.has(2011)?2011:null;
  assert.equal(photoCoastBaselineYear(data,t.readings),expected);assert.equal(layer.features[i].properties.baseline_year,expected);
  if(expected!==null)assert.equal(layer.features[i].properties.photo_start_kind,'photo');
  else assert.equal(layer.features[i].properties.delta_m,null);
  if(expected===2011)fallback++;
 });
 assert.ok(fallback>0);
});

test('old hypothetical annual increments cannot influence the new positions or metres',()=>{
 const altered={...model,targets:model.targets.map(t=>({...t,d:t.d.map(()=>99999)}))};
 assert.deepEqual(photoCoastComparison(model,data,2010,2011,11019),photoCoastComparison(altered,data,2010,2011,11019));
});

test('every offered local year/release produces a real compatible pair or its photographed baseline',()=>{
 const catalogue=JSON.parse(readFileSync(new URL('../lib/generated/municipal-photo-catalogue.json',import.meta.url),'utf8'));
 const received=JSON.parse(readFileSync(new URL('../public/data/history/esri-local-captures.json',import.meta.url),'utf8'));
 let checked=0;const seen=new Set<string>();
 for(const anchor of catalogue.anchors){
  const options=municipalComparisonOptions(received.items,catalogue,anchor.municipality,anchor.coordinates,17,anchor.coordinates);
  for(const option of options){
   const key=anchor.municipality+':'+option.year+':'+option.item.releaseNum;if(seen.has(key))continue;seen.add(key);
   const layer=compatiblePhotoCoastLayer(photoCoastComparison(model,data,2010,option.year,option.item.releaseNum),anchor.municipality);
   const scoped=compatiblePhotoCoastLayer(photoCoastComparison(model,data,2010,option.year,option.item.releaseNum,anchor.municipality),anchor.municipality);
   assert.deepEqual(scoped,layer,'scoping before computation must preserve every accepted result and source');
   assert(layer.features.length>0,key+' must have an accepted pair');
   for(const f of layer.features){assert.equal(f.properties.context_review,false);assert.equal(f.properties.photo_mismatch,false);assert.equal(f.properties.photo_end_kind,'photo');assert.equal(f.properties.photo_start_kind,'photo');assert.equal(Number(String(f.properties.photo_date).slice(0,4)),option.year);assert.equal(f.properties.municipality,anchor.municipality);}
   checked++;
  }
 }
 assert(checked>100);
});
