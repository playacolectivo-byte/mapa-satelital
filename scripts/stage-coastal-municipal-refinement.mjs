import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyCoastalMunicipalRefinement} from '../lib/coastal-municipal-refinement.ts';

const root=new URL('../',import.meta.url);
const work='work/hunucma-yobain/';
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const sha=path=>createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex');
const rawSha=sha('public/data/shorelines/photo-alignment/revised-data.json');

for(const {slug,photos} of read(work+'plan.json').scopes){
 const path='public/data/municipalities/'+slug+'/photos.json';
 const review=read(work+'refinement-'+slug+'.json');
 if(review.source_photos_sha256!==sha(path))throw new Error('La foto municipal cambió durante la revisión');
 const refined=applyCoastalMunicipalRefinement(read(path),review,rawSha);
 writeFileSync(new URL(photos,root),JSON.stringify(refined)+'\n');
}
