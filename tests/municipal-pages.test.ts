import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {routeMunicipality,municipalityHref} from '../lib/municipal-pages.ts';
import {parseRoadKilometre,findRoadKilometre,type RoadSearchRecord} from '../lib/road-search.ts';
import {validateCoastalScenario} from '../lib/coastal-scenario.ts';import {validatePhotoCoast} from '../lib/photo-coast.ts';import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {applyPhotoVisualReview} from '../lib/photo-visual-review.ts';import {applyPhotoDigitization} from '../lib/photo-digitization.ts';
const read=(p:string)=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));const data='public/data/';const pages=read('lib/generated/municipality-pages.json');
const raw=readFileSync(new URL('../'+data+'shorelines/photo-alignment/revised-data.json',import.meta.url));const sha=createHash('sha256').update(raw).digest('hex');
const original=read(data+'shorelines/scenario/model.json'),sourceReview=read(data+'shorelines/photo-alignment/revised-source-review.json');
const photos=applyPhotoDigitization(applyPhotoVisualReview(validatePhotoCoast(JSON.parse(raw.toString())),read(data+'shorelines/photo-alignment/revised-visual-review.json'),sha),read(data+'shorelines/photo-alignment/manual-digitization-20261103.json'),sha);
test('all 13 municipality URLs are independent, reversible deep links',()=>{assert.equal(pages.length,13);assert.equal(new Set(pages.map((p:{slug:string})=>p.slug)).size,13);for(const p of pages){assert.equal(routeMunicipality(municipalityHref(p.slug)),p.slug);assert.equal(routeMunicipality('/'),null);}assert.equal(routeMunicipality('/municipio/../../'),null);});
test('municipal payloads contain only their targets and preserve every original delta and photographic correction',()=>{
 const all=new Set<string>();for(const p of pages){const base=data+'municipalities/'+p.slug+'/';const model=validateCoastalScenario(read(base+'scenario.json')),local=validatePhotoCoast(read(base+'photos.json'));
 assert.ok(model.targets.length<original.targets.length);assert.equal(local.targets.length,model.targets.length);
 for(const [i,t] of model.targets.entries()){assert.equal(t.m,p.name);assert.ok(!all.has(t.id));all.add(t.id);const old=original.targets.find((x:{id:string})=>x.id===t.id);assert.deepEqual(t.d,old.d);assert.deepEqual(t.p,old.p);assert.deepEqual(t.support.map(row=>row.map(j=>model.sources[j].id)),old.support.map((row:number[])=>row.map(j=>original.sources[j].id)));assert.deepEqual(local.targets[i],photos.targets.find(x=>x.id===t.id));}
 const cache=createCoastalImageAlignment(model,local,sourceReview);for(const year of model.years){const frame=cache.read(year,22252);assert.ok(frame.layer.features.every(f=>f.properties.municipality===p.name));assert.equal(frame.layer.features.length,model.targets.filter(t=>t.type.startsWith('Playa')).length);}
 const config=read(base+'config.json');assert.deepEqual(config.focus_bounds,p.bounds);assert.deepEqual(config.navigation_bounds,p.navigation_bounds);assert.ok(config.places.every((x:{municipality:string})=>x.municipality===p.name));
 }
 assert.equal(all.size,4356);assert.equal(createHash('sha256').update(raw).digest('hex'),sha);
});
test('km search accepts decimal comma and half kilometres, distinguishes estimates, and refuses unsupported values',()=>{
 assert.equal(parseRoadKilometre('km 12,5'),12.5);assert.equal(parseRoadKilometre('12.25'),null);assert.equal(parseRoadKilometre('1e2'),null);assert.equal(parseRoadKilometre('-1'),null);
 let halves=0;for(const p of pages){const records=read(data+'municipalities/'+p.slug+'/road-search.json').records as RoadSearchRecord[];for(const r of records){assert.equal(findRoadKilometre(records,r.road,String(r.km))?.id,r.id);if(r.kind==='interpolated'){halves++;assert.equal(r.sources.length,2);assert.equal(r.km%1,.5);}else assert.equal(r.sources.length,1);}assert.equal(findRoadKilometre(records,'not a road','10'),null);}assert.ok(halves>30);
});
