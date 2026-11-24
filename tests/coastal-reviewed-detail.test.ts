import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {coastalAuditForReading} from '../lib/coastal-audit-provenance.ts';
import type {CoastalScenario} from '../lib/coastal-scenario.ts';
import type {PhotoCoastData} from '../lib/photo-coast.ts';
import type {PhotoSourceReview} from '../lib/photo-source-review.ts';

const read=(p:string)=>JSON.parse(readFileSync(new URL('../public/data/'+p,import.meta.url),'utf8'));
const sourceReview=read('shorelines/photo-alignment/revised-source-review.json') as PhotoSourceReview;
for(const [slug,id] of [['progreso','SC-88-0-75'],['dzemul','SC-88-0-164']]){
 const model=read('municipalities/'+slug+'/scenario.json') as CoastalScenario,photos=read('municipalities/'+slug+'/photos.json') as PhotoCoastData;
 test(slug+' retains its recognized z17 observation in the same edition at z18, with detail explicitly pending',()=>{
  const row=photos.targets.find(t=>t.id===id)!,reading=row.readings.find(r=>r.releases.includes(6984))!;
  assert.equal(reading.manual_review?.id,'ixil-waterline-review-20261108');assert.deepEqual(reading.detail_offsets,[]);assert.equal(coastalAuditForReading(reading),null);
  const before=JSON.stringify(row),year=Number(photos.captures[reading.capture].date.slice(0,4)),cache=createCoastalImageAlignment(model,photos,sourceReview);
  const general=cache.read(year,6984,17).layer.features.find(f=>f.id===id)!,detail=cache.read(year,6984,18).layer.features.find(f=>f.id===id)!;
  assert.ok(general&&detail);assert.equal(general.properties.photo_interpretation,true);assert.equal(detail.properties.photo_interpretation,true);
  assert.deepEqual(detail.geometry,general.geometry);assert.equal(detail.properties.delta_m,general.properties.delta_m);assert.equal(detail.properties.date_after,general.properties.date_after);
  assert.equal(detail.properties.image_alignment_release,6984);assert.equal(detail.properties.photo_review_tile_zoom,17);assert.equal(detail.properties.photo_detail_review_pending,true);
  const closer=cache.read(year,6984,19).layer.features.find(f=>f.id===id)!;assert.deepEqual(closer.geometry,general.geometry);assert.equal(closer.properties.photo_detail_review_pending,true);
  assert.equal(JSON.stringify(row),before,'enlargement does not invent a detail offset or modify the observed reading');
 });
 test(slug+' cannot extend an unrecognized manual marker into a new detail measurement',()=>{
  const altered=structuredClone(photos),reading=altered.targets.find(t=>t.id===id)!.readings.find(r=>r.releases.includes(6984))!;
  reading.manual_review={...reading.manual_review!,id:'unrecognized-review'};
  const year=Number(altered.captures[reading.capture].date.slice(0,4)),f=createCoastalImageAlignment(model,altered,sourceReview).read(year,6984,18).layer.features.find(f=>f.id===id);
  assert.notEqual(f?.properties.photo_interpretation,true);
 });
}
