import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {applyPhotoVisualReview} from '../lib/photo-visual-review.ts';
import {applyPhotoDigitization} from '../lib/photo-digitization.ts';
import {applyPhotoPilotReview} from '../lib/photo-pilot-review.ts';
import {applyUserShorelineGuides} from '../lib/user-shoreline-guides.ts';
import {applyMunicipalShorelineReview} from '../lib/municipal-shoreline-review.ts';
import {applyShorelineReferenceRefinement} from '../lib/shoreline-reference-refinement.ts';
import {existsSync} from 'node:fs';
import {validatePhotoCoast} from '../lib/photo-coast.ts';
import {withReviewedPhotoCatalogue} from '../lib/reviewed-photo-catalogue.ts';
const root=new URL('../',import.meta.url),folder='public/data/shorelines/photo-alignment/';
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const raw=await readFile(new URL(folder+'revised-data.json',root));
const sha=createHash('sha256').update(raw).digest('hex');
let photos=applyPhotoVisualReview(validatePhotoCoast(JSON.parse(raw)),await read(folder+'revised-visual-review.json'),sha);
photos=applyPhotoDigitization(photos,await read(folder+'manual-digitization-20261103.json'),sha);
photos=applyPhotoPilotReview(photos,await read(folder+'manual-progreso-oeste-20261105.json'),sha);
photos=applyUserShorelineGuides(photos,await read(folder+'user-guides-2011-20261105.json'),sha);
const fingerprints={};
for(const name of ['manual-progreso-full-20261105.json','manual-hunucma-20261105.json','manual-dzemul-20261105.json']){
 const bytes=await readFile(new URL(folder+name,root));fingerprints[name]=createHash('sha256').update(bytes).digest('hex');
 photos=applyMunicipalShorelineReview(photos,JSON.parse(bytes),sha);
}
const refinementName='reference-refinement-20261106.json';
if(existsSync(new URL(folder+refinementName,root))){
 const bytes=await readFile(new URL(folder+refinementName,root));fingerprints[refinementName]=createHash('sha256').update(bytes).digest('hex');
 photos=applyShorelineReferenceRefinement(photos,JSON.parse(bytes),sha);
}
validatePhotoCoast(photos);
const base=await read('lib/generated/municipal-photo-refined-catalogue.json'),model=await read('public/data/shorelines/scenario/model.json');
const catalogue={...withReviewedPhotoCatalogue(base,model,photos),reviewed_source_sha256:sha,reviewed_inputs_sha256:fingerprints,reviewed_scope_note:'Municipal cameras use all municipal profiles; local cameras use only profiles within 2 km. Dated browsing is separate from explicitly approved 2011/photo comparisons.'};
const dest=new URL('lib/generated/municipal-photo-reviewed-catalogue.json',root),temporary=new URL('lib/generated/municipal-photo-reviewed-catalogue.json.tmp',root);
await writeFile(temporary,JSON.stringify(catalogue)+'\n');await rename(temporary,dest);
console.log(JSON.stringify({captures:catalogue.captures.length,compatible_captures:catalogue.compatible_captures.length,reviewed_scopes:catalogue.anchors.filter(a=>a.review_scope).length,municipalities:catalogue.coastal_views.length}));
