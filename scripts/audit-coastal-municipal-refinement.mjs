import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {applyCoastal100mGrid,coastalLocalDistance,coastalLocalVector} from '../lib/coastal-100m-grid.ts';
import {applyCoastalMunicipalRefinement} from '../lib/coastal-municipal-refinement.ts';
import {coastalGridSpacingLinks} from '../lib/coastal-spacing.ts';

const root=new URL('../',import.meta.url);
const work='work/hunucma-yobain/';
const assets='public/data/shorelines/photo-alignment/';
const raw=path=>readFileSync(new URL(path,root));
const read=path=>JSON.parse(raw(path));
const sha=path=>createHash('sha256').update(raw(path)).digest('hex');
const stage=process.argv.includes('--stage');
const gridPath=stage?work+'grid.json':assets+'coastal-100m-hunucma-yobain.json';
const grid=read(gridPath);
const sourceReview=read(assets+'revised-source-review.json');
const csvRow=fields=>fields.map(field=>'"'+String(field??'').replaceAll('"','""')+'"').join(',');
const report={grid_sha256:sha(gridPath),scopes:[]};

const slugs=stage?read(work+'plan.json').scopes.map(scope=>scope.slug):['hunucma','yobain'];
for(const slug of slugs){
 const municipal='public/data/municipalities/'+slug+'/';
 const review=read((stage?work:assets)+'refinement-'+slug+'.json');
 const original=read(municipal+'photos.json');
 const photos=applyCoastalMunicipalRefinement(original,review,sha(assets+'revised-data.json'));
 const model=read(municipal+'scenario.json');
 const municipality=model.targets[0].m;
 const segments=grid.segments.filter(segment=>segment.municipality===municipality);
 const stations=segments.flatMap(segment=>segment.stations);
 const ids=new Map(stations.map(station=>[station.id,station]));
 assert.equal(ids.size,stations.length);
 assert.ok(stations.length);
 const changed=new Set(review.corrections.map(c=>c.profile_id+':'+c.capture));
 const withheld=new Map((review.withheld??[]).map(c=>[c.profile_id+':'+c.capture+':'+c.release,c.reason]));
 const byProfile=new Map(photos.targets.map(row=>[row.id,row]));
 for(let i=0;i<original.targets.length;i++){
  const before=original.targets[i],after=photos.targets[i];
  for(const reading of before.readings){
   if(!changed.has(before.id+':'+reading.capture))assert.deepEqual(after.readings.find(r=>r.capture===reading.capture),reading);
  }
  for(const approval of before.review_policy?.reviewed_captures??[]){
   if(approval.capture===before.fixed_reference?.capture&&!after.fixed_reference)continue;
   for(const release of approval.releases){
    if(!withheld.has(before.id+':'+approval.capture+':'+release)){
     assert.ok(after.review_policy?.reviewed_captures?.some(r=>r.capture===approval.capture&&r.releases.includes(release)));
    }
   }
  }
 }
 const frames=new Map();
 const beachRows=photos.targets.filter((row,i)=>model.targets[i].type.startsWith('Playa')||row.reviewed_beach_control);
 for(const row of beachRows){
  assert.ok(row.fixed_reference||row.reference_unavailable,row.id);
  for(const reading of row.readings){
   const year=Number(photos.captures[reading.capture].date.slice(0,4));
   if(year<2011||year>review.last_year)continue;
   for(const release of reading.releases)frames.set(year+':'+release,{year,release});
  }
 }
 const cache=createCoastalImageAlignment(model,photos,sourceReview);
 const comparisons=new Map();
 const pending=new Map();
 let checked=0;
 for(const {year,release} of frames.values()){
  const frame=applyCoastal100mGrid(cache.read(year,release).layer,grid);
  assert.equal(frame.features.length,stations.length);
  assert.equal(coastalGridSpacingLinks(frame).length,stations.length-segments.length);
  for(const link of coastalGridSpacingLinks(frame))assert.equal(link.chainage_m,100);
  for(const feature of frame.features){
   checked++;
   const p=feature.properties,station=ids.get(feature.id);
   assert.ok(station);
   assert.deepEqual(p.baseline_coordinate,station.coordinate);
   const key=station.id+':'+year;
   if(p.delta_m===null){
    assert.equal(p.photo_review_pending,true);
    const reasons=pending.get(key)??new Set();
    reasons.add(p.photo_review_reason);
    for(const id of new Set([station.left_profile_id,station.right_profile_id])){
     const reading=byProfile.get(id).readings.find(r=>r.releases.includes(release)&&Number(photos.captures[r.capture].date.slice(0,4))===year);
     const reason=reading&&withheld.get(id+':'+reading.capture+':'+release);
     if(reason)reasons.add(reason);
    }
    pending.set(key,reasons);
    continue;
   }
   assert.equal(feature.geometry.type,'LineString');
   assert.deepEqual(feature.geometry.coordinates[0],station.coordinate);
   const end=feature.geometry.coordinates[1];
   const vector=coastalLocalVector(station.coordinate,end);
   assert.ok(Math.abs(Math.abs(p.delta_m)-coastalLocalDistance(station.coordinate,end))<1e-7);
   assert.ok(Math.abs(vector[0]*station.axis[1]-vector[1]*station.axis[0])<.01);
   assert.equal(Number(p.date_after.slice(0,4)),year);
   assert.ok(p.date_before.startsWith('2011-'));
   if(year===2011)assert.equal(p.delta_m,0);
   const items=comparisons.get(key)??[];
   items.push({date:p.date_after,reference:p.date_before,release,delta:p.delta_m,estimated:p.estimated,direction:p.direction_unresolved?'incierta':p.delta_m>0?'hacia el mar':p.delta_m<0?'hacia tierra':'sin cambio'});
   comparisons.set(key,items);
  }
 }
 const csv=[['id','tramo','distancia_por_tramo_m','lon_2011','lat_2011','anio','fecha_referencia','fecha_captura','edicion','cambio_m','estimacion_espacial','direccion','estado']];
 const years=[];
 for(let year=2011;year<=review.last_year;year++){
  let available=0;
  const dates=new Set();
  for(const segment of segments)for(const station of segment.stations){
   const key=station.id+':'+year;
   const rows=comparisons.get(key);
   const common=[station.id,segment.id,station.chainage_m,...station.coordinate,year];
   if(rows){
    available++;
    for(const item of rows.sort((a,b)=>a.date.localeCompare(b.date)||a.release-b.release)){
     dates.add(item.date);
     csv.push([...common,item.reference,item.date,item.release,item.delta.toFixed(2),item.estimated,item.direction,'medicion_disponible']);
    }
   }else{
    const reference=byProfile.get(station.left_profile_id).fixed_reference;
    const referenceDate=photos.captures[reference.capture].date;
    csv.push([...common,referenceDate,'','','','','',pending.has(key)?[...pending.get(key)].join('|'):'sin_fotografia_para_el_anio']);
   }
  }
  years.push({year,available,pending:stations.length-available,dates:[...dates].sort()});
 }
 assert.equal(years[0].available,stations.length);
 const gaps=beachRows.filter(row=>row.reference_unavailable).map(row=>({id:row.id,reason:row.reference_unavailable.reason}));
 for(const gap of gaps)for(let year=2011;year<=review.last_year;year++){
  csv.push([gap.id,'','','','',year,'','','','','','',gap.reason]);
 }
 const path=(stage?work:'docs/qa/')+slug+'-punto-anio.csv';
 writeFileSync(new URL(path,root),csv.map(csvRow).join('\n')+'\n');
 report.scopes.push({slug,stations:stations.length,segments:segments.length,reference_gaps:gaps,year_edition_frames:frames.size,station_frames_checked:checked,years});
}
writeFileSync(new URL((stage?work:'docs/qa/')+'hunucma-yobain-audit.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.scopes.map(({reference_gaps,...s})=>({...s,reference_gaps:reference_gaps.length}))));
