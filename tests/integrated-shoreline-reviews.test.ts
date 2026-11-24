import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyIntegratedPhotoReviews} from '../lib/integrated-photo-reviews.ts';
import {applyPhotoVisualReview} from '../lib/photo-visual-review.ts';
import {applyPhotoDigitization} from '../lib/photo-digitization.ts';
import {applyDatedImageReview} from '../lib/dated-image-review.ts';
import {datedImageReviews,isDatedReviewProfile} from '../lib/dated-image-reviews.ts';
import {applyPhotoPilotReview} from '../lib/photo-pilot-review.ts';
import {applyUserShorelineGuides} from '../lib/user-shoreline-guides.ts';
import {applyCurrentMunicipalReviews} from '../lib/current-shoreline-reviews.ts';
import {applyRegionalShorelineReviews} from '../lib/regional-shoreline-reviews.ts';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {applyCoastal100mGrid,type Coastal100mGrid} from '../lib/coastal-100m-grid.ts';
import {validatePhotoCoast} from '../lib/photo-coast.ts';
const read=(p:string)=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const dir='public/data/shorelines/photo-alignment/';
const sha=createHash('sha256').update(readFileSync(new URL('../'+dir+'revised-data.json',import.meta.url))).digest('hex');
const initial=applyPhotoDigitization(applyPhotoVisualReview(validatePhotoCoast(read(dir+'revised-data.json')),read(dir+'revised-visual-review.json'),sha),read(dir+'manual-digitization-20261103.json'),sha);
// This regression verifies the pre-audit branch merge; the audit package has
// its own exact-old-values integration coverage in coastal-audit-reviews.
const integrated=await applyIntegratedPhotoReviews(initial,sha,async url=>read('public'+url),null);
const local=datedImageReviews.reduce((data,v)=>applyDatedImageReview(data,read('public'+v.url),sha,v),initial);
const incoming=applyRegionalShorelineReviews(applyCurrentMunicipalReviews(applyUserShorelineGuides(applyPhotoPilotReview(initial,read(dir+'manual-progreso-oeste-20261105.json'),sha),read(dir+'user-guides-2011-20261105.json'),sha),sha),sha);
const model=read('public/data/shorelines/scenario/model.json');

test('integration preserves all latest local point/date decisions and every non-overlapping incoming decision',()=>{
 let preserved=0,imported=0,overlaps=0;
 integrated.targets.forEach((row,i)=>{
  const expected=isDatedReviewProfile(row.id,model.targets[i].m)?local.targets[i]:incoming.targets[i];
  assert.deepEqual(row,JSON.parse(JSON.stringify(expected)),row.id);
  if(isDatedReviewProfile(row.id,model.targets[i].m)){preserved++;if(JSON.stringify(incoming.targets[i])!==JSON.stringify(local.targets[i]))overlaps++;}
  else if(JSON.stringify(row)!==JSON.stringify(local.targets[i]))imported++;
 });
 assert.equal(preserved,532);assert.equal(imported,1099);assert(overlaps>0);
});

test('incoming grid never replaces or moves the latest Celestun and Ixil/context photo results',()=>{
 const cache=createCoastalImageAlignment(model,integrated,read(dir+'revised-source-review.json'));
 const previous=read(dir+'coastal-100m-grid-20261106.json'),regional=read(dir+'coastal-100m-hunucma-yobain.json');
 const replaced=new Set(regional.segments.map((s:{municipality:string})=>s.municipality));
 const grid={...previous,segments:[...previous.segments.filter((s:{municipality:string})=>!replaced.has(s.municipality)),...regional.segments]} as Coastal100mGrid;
 for(const [year,release] of [[2011,11019],[2019,14222],[2022,57624],[2025,22252]]){
  const frame=cache.read(year,release).layer,after=applyCoastal100mGrid(frame,grid),byId=new Map(after.features.map(f=>[f.id,f]));
  for(const f of frame.features)if(isDatedReviewProfile(String(f.id),String(f.properties.municipality)))assert.deepEqual(byId.get(f.id),f,`${year}:${release}:${f.id}`);
  assert.equal(new Set(after.features.map(f=>f.id)).size,after.features.length);
 }
});
