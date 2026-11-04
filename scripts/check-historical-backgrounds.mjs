import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { exactHistoricalBackground, earlierHistoricalReference, validateHistoricalBackgroundManifest } from '../lib/historical-background.ts';
import { historicalContextForYear, historicalContextMessage } from '../lib/historical-context.ts';
import { createEvolutionIndex, validateEvolutionCatalogue, evolutionComparison } from '../lib/coastal-evolution.ts';
import { mergePublishedTransects, publishedValues } from '../lib/problems.ts';
const root=new URL('../',import.meta.url),read=async p=>readFile(new URL(p,root));
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=validateHistoricalBackgroundManifest(JSON.parse(await read('public/data/historical-background/manifest.json')));
const proofs=JSON.parse(await read('scientific/coverage-extension/historical-background-proof.json'));
const hashes=new Set();let inputs=0;
for(const frame of manifest.frames){
  assert.equal(hash(await read('public'+frame.image)),frame.image_sha256);hashes.add(frame.image_sha256);
  const proof=proofs.frames.find(p=>p.product===frame.product_id);
  assert.equal(proof.capture.slice(0,10),frame.date);
  assert.equal(proof.no_new_measurements,true);
  for(const input of proof.inputs){assert.equal(hash(await read(input.path)),input.sha256);inputs++;}
  assert.equal(exactHistoricalBackground(manifest,frame.year).id,frame.id);
}
assert.equal(hashes.size,manifest.frames.length,'Dates must not share a relabelled image');
const observations=await read('public/data/littoral/coastal-evolution.json');
assert.equal(hash(observations),hash(execFileSync('git',['show','83a4e777f2f7a9c9ae115ca1290574d5652328ba:public/data/littoral/coastal-evolution.json'],{cwd:root,maxBuffer:40*1024*1024})),'Annual positions must remain unchanged');
const index=createEvolutionIndex(validateEvolutionCatalogue(JSON.parse(observations)));
const inventory=mergePublishedTransects(await Promise.all(['l5','l8','s2'].map(async n=>JSON.parse(await read('public/data/problems/s34-'+n+'.geojson')))));
const byId=new Map(inventory.features.map(f=>[f.properties.idPol_Tran,f]));
const originalHistorical=JSON.parse(await read('public/data/problems/s34-l5.geojson'));
const originalHistoricalIds=new Set(originalHistorical.features.map(f=>f.properties.idPol_Tran));
const years=[];
for(let year=1986;year<=2010;year++){
  const exact=exactHistoricalBackground(manifest,year),reference=exact??earlierHistoricalReference(manifest,year);
  assert(reference&&reference.year<=year,'Never use a future photograph');
  const context=historicalContextForYear(inventory,index,year);
  assert(context&&context.features.length);
  for(const f of context.features){
    const original=byId.get(f.properties.idPol_Tran),value=publishedValues(original,'L5');
    assert.deepEqual(f.geometry,original.geometry);
    assert.equal(f.properties.rate,value.rate);assert.equal(f.properties.category,value.category);
    assert(originalHistoricalIds.has(f.properties.idPol_Tran),'Only received historical erosion records belong in the complement');
    assert.notEqual(evolutionComparison(index,f.properties.idPol_Tran,year).status,'available','Keep measured displacement in the foreground');
    assert.equal(f.properties.historical_period,'1986–2011');
    assert.match(historicalContextMessage(f,year),/promedio de todo ese periodo/);
  }
  years.push({year,image_year:reference.year,capture:reference.date,exact_image:!!exact,historical_axes:context.features.length});
}
assert.equal(historicalContextForYear(inventory,index,2012),null);
assert.equal(historicalContextForYear(inventory,index,2026),null);
assert.deepEqual(new Set(historicalContextForYear(inventory,index,2000).features.map(f=>f.properties.idPol_Tran)),originalHistoricalIds);
assert.throws(()=>validateHistoricalBackgroundManifest({...manifest,frames:[{...manifest.frames[0],year:1990}]}));
const report={checked_at:new Date().toISOString(),status:'passed',image_frames:manifest.frames.length,unique_images:hashes.size,checked_immutable_input_bands:inputs,
  exact_years:years.filter(y=>y.exact_image).map(y=>y.year),earlier_reference_years:years.filter(y=>!y.exact_image).map(y=>y.year),
  unchanged_waterline_catalogue_sha256:hash(observations),published_period:'1986–2011',published_reference_axes:historicalContextForYear(inventory,index,2000).features.length,
  no_new_annual_measurements:true,no_future_background_images:true,years};
await writeFile(new URL('docs/qa/historical-backgrounds-2026-10-27.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,years:undefined}));
