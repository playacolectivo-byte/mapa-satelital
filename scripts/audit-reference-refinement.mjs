import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {applyCoastal100mGrid,coastalLocalDistance} from '../lib/coastal-100m-grid.ts';
import {coastalGridSpacingLinks} from '../lib/coastal-spacing.ts';
const root=new URL('../',import.meta.url),work='work/chicxulub-reference-review-20261106/',folder='public/data/shorelines/photo-alignment/';
const read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(new URL(p,root))).digest('hex');
const stageGeometry=process.argv.includes('--stage-geometry'),stage=stageGeometry||process.argv.includes('--stage-controls');
const beforePath=work+'before-reference-refinement-photos.json',photoPath=stage?work+'photos-stage.json':'public/data/municipalities/progreso/photos.json',gridPath=stage?work+(stageGeometry?'grid-geometry-stage.json':'grid-stage.json'):folder+'coastal-100m-grid-20261106.json';
const before=read(beforePath),after=read(photoPath),grid=read(gridPath);
const revisionPath=stage?work+(stageGeometry?'geometry-stage.json':'controls-stage.json'):folder+'reference-refinement-20261106.json';
const revision=read(revisionPath);
assert.equal(hash(beforePath),revision.source_photos_sha256);
assert.equal(before.targets.length,after.targets.length);
if(!stage)assert.equal(hash(gridPath),revision.visual_grid_review.grid_sha256);
const changed=new Set([...revision.corrections,...revision.uninterpretable_references].map(x=>x.profile_id));
let preserved=0;
for(let i=0;i<before.targets.length;i++){
 const a=before.targets[i],b=after.targets[i];assert.equal(a.id,b.id);
 if(!changed.has(a.id))assert.deepEqual(a,b);
 const retained=t=>t.readings.filter(r=>r.capture!==40);
 assert.deepEqual(retained(a),retained(b));preserved+=retained(a).length;
 const later=t=>t.review_policy?.reviewed_captures?.filter(r=>r.capture!==40);
 assert.deepEqual(later(a),later(b));
}
const model=read('public/data/municipalities/progreso/scenario.json'),sourceReview=read(folder+'revised-source-review.json');
const cache=createCoastalImageAlignment(model,after,sourceReview);
const stations=grid.segments.filter(s=>s.municipality==='Progreso').flatMap(s=>s.stations),stationMap=new Map(stations.map(s=>[s.id,s]));
const inChicxulub=s=>s.coordinate[0]>=-89.6442&&s.coordinate[0]<=-89.5702;
const chicxulub=stations.filter(inChicxulub),ids=new Set(chicxulub.map(s=>s.id));
if(!stage)assert.equal(chicxulub.length,revision.visual_grid_review.chicxulub_stations_reviewed);
const frames=new Map();
for(const t of after.targets)for(const c of t.review_policy?.reviewed_captures??[]){
 const year=Number(after.captures[c.capture].date.slice(0,4));if(year<2011||year>2025)continue;
 for(const release of c.releases)frames.set(year+':'+release,{year,release});
}
const yearStation=new Map();let tested=0,measured=0,pending=0;
for(const {year,release} of frames.values()){
 const frame=applyCoastal100mGrid(cache.read(year,release).layer,grid);
 assert.equal(frame.features.length,stations.length);assert.equal(frame.features.some(f=>f.properties.baseline_fixed===false),false);
 for(const link of coastalGridSpacingLinks(frame))assert.equal(link.chainage_m,100);
 for(const f of frame.features){
  const station=stationMap.get(f.id);assert.deepEqual(f.properties.baseline_coordinate,station.coordinate);tested++;
  if(typeof f.properties.delta_m!=='number'){assert.equal(f.properties.delta_m,null);assert.equal(f.properties.photo_review_pending,true);pending++;continue;}
  assert.equal(f.geometry.type,'LineString');assert.deepEqual(f.geometry.coordinates[0],station.coordinate);
  assert.ok(Math.abs(Math.abs(f.properties.delta_m)-coastalLocalDistance(station.coordinate,f.geometry.coordinates[1]))<1e-7);
  assert.equal(Number(String(f.properties.date_after).slice(0,4)),year);
  assert.equal(f.properties.date_before,'2011-08-01');measured++;
  if(ids.has(f.id)){
   const key=f.id+':'+year,current=yearStation.get(key);
   if(!current||String(f.properties.date_after)>current.date)yearStation.set(key,{date:f.properties.date_after,release,delta_m:f.properties.delta_m,derived:f.properties.estimated===true});
  }
 }
}
const years=[];
const csv=[['station_id','chainage_m','lon_2011','lat_2011','year','capture_date','release','delta_m','derived_spatially','status']];
for(let year=2011;year<=2025;year++){
 let available=0;
 for(const s of chicxulub){const item=yearStation.get(s.id+':'+year);if(item)available++;csv.push([s.id,s.chainage_m,...s.coordinate,year,item?.date??'',item?.release??'',item?.delta_m??'',item?.derived??'',item?'available':'pending_without_metres']);}
 years.push({year,with_reviewed_position:available,pending:chicxulub.length-available});
}
const report={status:'pass',review_sha256:hash(revisionPath),grid_sha256:hash(gridPath),photos_before_sha256:hash(beforePath),photos_after_sha256:hash(photoPath),later_original_readings_preserved:preserved,refined_controls:revision.corrections.length,ambiguous_controls:revision.uninterpretable_references.map(r=>r.profile_id),progreso_stations:stations.length,chicxulub_stations:chicxulub.length,year_edition_frames:frames.size,station_frames_checked:tested,measured,pending,years};
const dest=stage?work+'reference-refinement-stage-audit.json':'docs/qa/chicxulub-reference-refinement-audit-20261106.json';
writeFileSync(new URL(dest,root),JSON.stringify(report,null,2)+'\n');
if(!stage)writeFileSync(new URL('docs/qa/chicxulub-punto-anio-20261106.csv',root),csv.map(row=>row.join(',')).join('\n')+'\n');
console.log(JSON.stringify(report));
