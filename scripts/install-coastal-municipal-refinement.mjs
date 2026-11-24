import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const work='work/hunucma-yobain/';
const output='public/data/shorelines/photo-alignment/';
const raw=path=>readFileSync(new URL(path,root));
const read=path=>JSON.parse(raw(path));
const sha=path=>createHash('sha256').update(raw(path)).digest('hex');
const write=(path,bytes)=>{
 const target=new URL(path,root),temporary=new URL(path+'.tmp',root);
 writeFileSync(temporary,bytes);
 renameSync(temporary,target);
};
const grid=read(work+'grid.json');
const plan=read(work+'plan.json');
const audit=read(work+'hunucma-yobain-audit.json');
assert.equal(audit.grid_sha256,sha(work+'grid.json'));
assert.deepEqual(plan.scopes.map(scope=>scope.slug).sort(),['hunucma','yobain']);
const reviewed=[];
for(const {slug,municipality} of plan.scopes){
 const stations=grid.segments.filter(s=>s.municipality===municipality).flatMap(s=>s.stations);
 const coordinates=new Map(stations.map(s=>[s.id,s.coordinate]));
 const path=work+slug+'/station-review-final/independent-review.json';
 const review=read(path);
 assert.equal(review.status,'independent_visual_review_complete');
 assert.equal(review.accepted,stations.length);
 assert.equal(review.needs_adjustment,0);
 assert.equal(review.unresolved,0);
 assert.equal(review.rows.length,stations.length);
 assert.deepEqual(new Map(review.rows.map(r=>[r.id,r.coordinate])),coordinates);
 const input=work+'refinement-'+slug+'.json';
 const asset=read(input);
 assert.equal(asset.source_photos_sha256,sha('public/data/municipalities/'+slug+'/photos.json'));
 asset.station_visual_review={stations:stations.length,path,sha256:sha(path),grid_sha256:audit.grid_sha256};
 reviewed.push({slug,asset});
}
for(const {slug,asset} of reviewed)write(output+'refinement-'+slug+'.json',JSON.stringify(asset,null,2)+'\n');
write(output+'coastal-100m-hunucma-yobain.json',raw(work+'grid.json'));
