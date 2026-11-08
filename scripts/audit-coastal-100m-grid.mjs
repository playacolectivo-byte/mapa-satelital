import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {applyCoastal100mGrid,coastalLocalDistance,coastalLocalVector} from '../lib/coastal-100m-grid.ts';
import {coastalGridSpacingLinks} from '../lib/coastal-spacing.ts';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const grid=read('public/data/shorelines/photo-alignment/coastal-100m-grid-20261106.json');
const sourceReview=read('public/data/shorelines/photo-alignment/revised-source-review.json');
const report={status:'pass',grid_sha256:createHash('sha256').update(readFileSync(new URL('../public/data/shorelines/photo-alignment/coastal-100m-grid-20261106.json',import.meta.url))).digest('hex'),station_frames_checked:0,measured:0,pending:0,baseline_frames:[],scopes:[]};
for(const slug of ['progreso','hunucma','dzemul']){
 const base='public/data/municipalities/'+slug+'/',model=read(base+'scenario.json'),photos=read(base+'photos.json');
 const cache=createCoastalImageAlignment(model,photos,sourceReview),name=model.targets[0].m;
 const segments=grid.segments.filter(s=>s.municipality===name),stations=segments.flatMap(s=>s.stations),ids=new Map(stations.map(s=>[s.id,s]));
 assert.ok(stations.length);report.scopes.push({slug,stations:stations.length,segments:segments.length});
 for(let year=2010;year<=2026;year++)for(const release of [11019,18820,22252,26334]){
  const raw=cache.read(year,release).layer,frame=applyCoastal100mGrid(raw,grid),features=frame.features.filter(f=>ids.has(String(f.id)));
  assert.equal(features.length,stations.length);
  const links=coastalGridSpacingLinks(frame);assert.equal(links.length,segments.reduce((n,s)=>n+s.stations.length-1,0));
  for(const link of links)assert.equal(link.chainage_m,100);
  for(const f of features){const s=ids.get(f.id);assert.deepEqual(f.properties.baseline_coordinate,s.coordinate);report.station_frames_checked++;
   if(typeof f.properties.delta_m==='number'){
    assert.equal(f.geometry.type,'LineString');assert.deepEqual(f.geometry.coordinates[0],s.coordinate);
    const distance=coastalLocalDistance(s.coordinate,f.geometry.coordinates[1]),vector=coastalLocalVector(s.coordinate,f.geometry.coordinates[1]);
    assert.ok(Math.abs(Math.abs(f.properties.delta_m)-distance)<1e-8);assert.ok(Math.abs(vector[0]*s.axis[1]-vector[1]*s.axis[0])<.01,JSON.stringify({id:f.id,year,release,vector,axis:s.axis,exact:!f.properties.grid_spatial_interpolation}));
    if(year===2011&&release===11019){assert.equal(f.properties.delta_m,0);assert.deepEqual(f.geometry.coordinates[1],s.coordinate);}
    assert.ok(f.properties.grid_metadata_describes_controls);report.measured++;
   }else{assert.equal(f.properties.delta_m,null);assert.equal(f.properties.photo_review_pending,true);report.pending++;}
  }
  if(year===2011&&release===11019){const measured=features.filter(f=>typeof f.properties.delta_m==='number').length;assert.equal(measured,stations.length);report.baseline_frames.push({slug,measured,total:stations.length});}
 }
}
writeFileSync(new URL('../docs/qa/coastal-100m-runtime-audit-20261106.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
