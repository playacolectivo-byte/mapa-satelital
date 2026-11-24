import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyIntegratedPhotoReviews} from '../lib/integrated-photo-reviews.ts';
import {applyPhotoVisualReview} from '../lib/photo-visual-review.ts';
import {applyPhotoDigitization} from '../lib/photo-digitization.ts';
import {validatePhotoCoast} from '../lib/photo-coast.ts';
import type {CoastalAuditReview,CoastalAuditData} from '../lib/coastal-audit-reviews.ts';

const bytes=(p:string)=>readFileSync(new URL('../'+p,import.meta.url));
const read=(p:string)=>JSON.parse(bytes(p).toString());
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const folder='public/data/shorelines/photo-alignment/';
const raw=bytes(folder+'revised-data.json'),sha=hash(raw);
const initial=applyPhotoDigitization(applyPhotoVisualReview(validatePhotoCoast(JSON.parse(raw.toString())),read(folder+'revised-visual-review.json'),sha),read(folder+'manual-digitization-20261103.json'),sha);
const load=async(url:string,expected:string)=>{const b=bytes('public'+url);assert.equal(hash(b),expected);return JSON.parse(b.toString());};
const before=await applyIntegratedPhotoReviews(initial,sha,load,null);
const manifest=read('lib/generated/coastal-audit-20261109.json') as CoastalAuditReview;
const after=await applyIntegratedPhotoReviews(initial,sha,load,manifest) as CoastalAuditData;
const model=read('public/data/shorelines/scenario/model.json');
const municipalities=new Map<string,string>(model.targets.map((t:{id:string;m:string})=>[t.id,t.m]));
// These five Progreso readings overlap the protected Ixil context. Each has
// a new independent visual review; every other prior Ixil reading stays exact.
const protectedExceptions=new Set(['SC-88-0-93:177','SC-88-0-85:201','SC-88-0-101:201','SC-88-0-118:208','SC-88-0-119:208']);

test('the public audit is byte-identical to the package used by the shared merge',()=>{
 assert.deepEqual(bytes('lib/generated/coastal-audit-20261109.json'),bytes(folder+'coastal-audit-20261109.json'));
 assert.equal(manifest.data_sha256,sha);assert.equal(manifest.model_sha256,before.model_sha256);assert.equal(manifest.field_validated,false);
 assert.equal(manifest.decisions.length,515);
 const count=(name:string)=>manifest.decisions.filter(d=>municipalities.get(d.profileId)===name).length;
 assert.equal(count('Dzemul'),17);assert.equal(count('Yobaín'),83);assert.equal(count('Celestún'),40);assert.equal(count('Progreso'),375);
 for(const d of manifest.decisions)assert.ok(['Dzemul','Yobaín','Celestún','Progreso'].includes(municipalities.get(d.profileId)!));
});

test('real decisions match their original values and change exactly their enumerated readings',()=>{
 const lookup=new Map(manifest.decisions.map(d=>[d.profileId+':'+d.capture,d]));let changed=0,protectedIxil=0;
 for(let i=0;i<before.targets.length;i++){
  const a=before.targets[i],b=after.targets[i];assert.equal(a.id,b.id);
  if(!manifest.decisions.some(d=>d.profileId===a.id))assert.deepEqual(b,a);
  for(let j=0;j<a.readings.length;j++){
   const old=a.readings[j],next=b.readings[j],d=lookup.get(a.id+':'+old.capture);
   if(!d){assert.deepEqual(next,old);continue;}
   changed++;assert.equal(old.offset_m,d.oldOffset);assert.equal(old.accepted,d.oldAccepted);
   assert.equal(next.offset_m,d.newOffset);assert.equal(next.accepted,d.newAccepted);
   assert.equal(next.coastal_audit?.review_id,manifest.review_id);assert.equal(next.coastal_audit?.timestamp,manifest.timestamp);
   if(old.manual_review)assert.deepEqual(next.coastal_audit?.history.at(-1)?.manual_review,old.manual_review);
   if(old.manual_review?.id==='ixil-waterline-review-20261108'){assert.ok(protectedExceptions.has(a.id+':'+old.capture));protectedIxil++;}
  }
 }
 assert.equal(changed,manifest.decisions.length);assert.equal(protectedIxil,protectedExceptions.size);validatePhotoCoast(after);
});

test('accepted manifest positions bind matching metadata, their interval, and public evidence',()=>{
 const publicEvidence='/data/shorelines/photo-alignment/coastal-audit-20261109-evidence.json';
 const evidenceHash=hash(bytes('public'+publicEvidence));
 for(const d of manifest.decisions){
  const capture=after.captures[d.capture];assert.equal(capture.date,d.date);
  assert.ok(d.evidence.length>0);for(const e of d.evidence)assert.match(e.sha256,/^[a-f0-9]{64}$/);
  for(const e of d.evidence)if(e.path===publicEvidence)assert.equal(e.sha256,evidenceHash);
  for(const e of d.evidence)if(e.path.startsWith('/data/')&&e.path.endsWith('.json'))assert.equal(e.sha256,hash(bytes('public'+e.path)));
  if(d.newAccepted){
   assert.equal(d.metadata?.release,d.sourceRelease);assert.equal(d.metadata?.positionOffset,d.newOffset);
   assert.ok(d.metadata!.checks.some(c=>c.delta_m===0));assert.ok(d.metadata!.checks.some(c=>c.delta_m<0));assert.ok(d.metadata!.checks.some(c=>c.delta_m>0));
   for(const c of d.metadata!.checks){assert.equal(c.date,capture.date);assert.equal(c.sensor,capture.source);}
   assert.ok(d.positionVisualInterval![0]<=d.newOffset!&&d.positionVisualInterval![1]>=d.newOffset!);assert.ok(d.uncertaintyM!>0);
  }else{assert.equal(d.newOffset,null);assert.equal(d.positionVisualInterval,null);assert.ok(d.reason.trim());}
 }
 const evidence=read('public'+publicEvidence);
 assert.equal(evidence.yobain_original_container_is_gzip_with_padding,true);
 assert.equal(evidence.yobain_decoded_sha256,'44bff888dddc8c6f646656b8a73ae124a13f6b40605949018c390006aaee8b64');
});

test('recovered endpoints do not invent a missing 2011 baseline',()=>{
 for(const d of manifest.decisions.filter(d=>d.newAccepted&&!d.oldAccepted)){
  const previous=before.targets.find(t=>t.id===d.profileId)!;
  if(previous.reference_unavailable)assert.deepEqual(after.targets.find(t=>t.id===d.profileId)!.reference_unavailable,previous.reference_unavailable);
 }
});

test('independent Celestun first-half review adds nine supported positions and three withdrawals',()=>{
 const expected:[string,number,number|null][]=[['SC-3-0-2',7,10],['SC-6-0-0',7,0],['SC-6-0-1',8,-2],['SC-6-0-7',8,30],['SC-6-0-8',8,41],['SC-6-0-0',6,1],['SC-4-0-247',33,-10],['SC-4-0-258',33,5],['SC-4-0-178',4,-31.5],['SC-30-0-1',6,null],['SC-4-0-185',16,null],['SC-4-0-450',6,null]];
 for(const [profile,capture,offset] of expected){const d=manifest.decisions.find(d=>d.profileId===profile&&d.capture===capture)!;assert.ok(d);assert.equal(d.newOffset,offset);assert.equal(d.newAccepted,offset!==null);}
 assert.equal(manifest.decisions.some(d=>d.profileId==='SC-3-0-0'&&d.capture===7),false);
 const evidence=read(folder+'coastal-audit-20261109-celestun-first-half-evidence.json');
 assert.equal(evidence.summary.rows,1656);assert.equal(evidence.summary.independently_reviewed_contexts,52);assert.equal(evidence.summary.independently_reviewed_candidates,10);
 assert.equal(evidence.summary.confirmed_adjustments,9);assert.equal(evidence.summary.withdrawals,3);
});

test('final Progreso batch binds every protected exception to new evidence and retains inconclusive prior review',()=>{
 const evidence=read(folder+'coastal-audit-20261109-progreso-evidence.json');
 assert.equal(evidence.summary.source_readings,5011);assert.equal(evidence.summary.first_pass_readings,5011);
 assert.equal(evidence.summary.changes_total,375);assert.equal(evidence.summary.changes_by_type.visual_reposition,309);assert.equal(evidence.summary.changes_by_type.natural_contact_unresolved,66);
 assert.equal(evidence.proposed_position_tile_coverage.all_present,true);
 for(const key of protectedExceptions){
  const [id,capture]=key.split(':'),d=manifest.decisions.find(d=>d.profileId===id&&d.capture===Number(capture))!;
  assert.ok(d?.newAccepted);const original=evidence.changes.find((c:{profileId:string;capture:string})=>c.profileId===id&&Number(c.capture)===Number(capture));
  assert.ok(evidence.independent_rechecks.some((r:{index:number;result:string})=>r.index===original.index&&r.result==='agree_with_root_within_visual_uncertainty'));
  assert.equal(after.targets.find(t=>t.id===id)!.readings.find(r=>r.capture===Number(capture))!.coastal_audit?.history.at(-1)?.manual_review?.id,'ixil-waterline-review-20261108');
 }
 const held=(data:typeof before)=>data.targets.find(t=>t.id==='SC-88-0-81')!.readings.find(r=>r.capture===204)!;
 assert.deepEqual(held(after),held(before));assert.equal(manifest.decisions.some(d=>d.profileId==='SC-88-0-81'&&d.capture===204),false);
 assert.equal(manifest.decisions.find(d=>d.profileId==='SC-C458-0-1'&&d.capture===226)?.newAccepted,false);
});
