import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyCoastalAuditReview,type CoastalAuditReview,type CoastalAuditDecision,type CoastalAuditData} from '../lib/coastal-audit-reviews.ts';
import {applyIntegratedPhotoReviews} from '../lib/integrated-photo-reviews.ts';
import {applyPhotoVisualReview} from '../lib/photo-visual-review.ts';
import {applyPhotoDigitization} from '../lib/photo-digitization.ts';
import {validatePhotoCoast,photoCoastComparison,type PhotoCoastData} from '../lib/photo-coast.ts';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {coastalAuditForReading} from '../lib/coastal-audit-provenance.ts';
import {compatibleSourceLayer} from '../lib/photo-source-review.ts';
import type {CoastalScenario} from '../lib/coastal-scenario.ts';
const sha='a'.repeat(64),modelSha='b'.repeat(64),evidenceSha='c'.repeat(64);
function fixture():PhotoCoastData{return {
 version:1,method:'fixture',field_validated:false,model_sha256:modelSha,
 captures:[
  {date:'2011-01-01',source:'WV02',provider:'fixture',resolution_m:.5,accuracy_m:5},
  {date:'2020-02-02',source:'WV03',provider:'fixture',resolution_m:.5,accuracy_m:5},
  {date:'2026-01-25',source:'WV03',provider:'fixture',resolution_m:.5,accuracy_m:5}],
 targets:[{id:'A',readings:[
  {capture:0,offset_m:0,spread_m:3,releases:[101,102],accepted:true,reasons:[],manual_review:{id:'legacy',source:'A:0',uncertainty_m:4}},
  {capture:1,offset_m:12,spread_m:3,releases:[201,202],accepted:true,reasons:[],detail_offsets:[[201,13],[202,14]],manual_review:{id:'legacy',source:'A:1',uncertainty_m:4}},
  {capture:2,offset_m:null,spread_m:null,releases:[301],accepted:false,reasons:['unresolved']}],
  fixed_reference:{capture:0,method:'legacy',source:'A:0',verified_release:101},
  review_policy:{method:'legacy',reference_capture:0,first_year:2011,last_year:2025,reviewed_releases:[101,102,201,202],reviewed_captures:[{capture:0,releases:[101,102]},{capture:1,releases:[201,202]}]}},
  {id:'IXIL-PROTECTED',readings:[{capture:1,offset_m:42,spread_m:3,releases:[201],accepted:true,reasons:[],manual_review:{id:'ixil-last-review',source:'protected',uncertainty_m:4}}]}]
};}
function decision():CoastalAuditDecision{return {
 profileId:'A',capture:1,oldOffset:12,oldAccepted:true,newOffset:7,newAccepted:true,sourceRelease:201,date:'2020-02-02',
 positionVisualInterval:[3,11],uncertaintyM:4,evidence:[{path:'review/strip.jpg',sha256:evidenceSha}],
 metadata:{release:201,positionOffset:7,url:'https://example.test/metadata',sha256:evidenceSha,checks:[-3,0,3].map(delta_m=>({delta_m,date:'2020-02-02',sensor:'WV03'}))},
 reason:'Visible sand-water contact'
};}
function review(d:CoastalAuditDecision[]= [decision()]):CoastalAuditReview{return {version:1,field_validated:false,review_id:'coastal-audit-fixture',timestamp:'2026-11-09T14:00:00Z',data_sha256:sha,model_sha256:modelSha,method_url:'/data/audit/method.md',decisions:d};}
function referenceDecision():CoastalAuditDecision{
 const d=decision();return {...d,capture:0,oldOffset:0,newOffset:2,sourceRelease:101,date:'2011-01-01',positionVisualInterval:[-2,6],metadata:{...d.metadata!,release:101,positionOffset:2,checks:[-4,0,4].map(delta_m=>({delta_m,date:'2011-01-01',sensor:'WV02'}))}};
}
function model():CoastalScenario{return {version:1,scenario_unvalidated:true,years:Array.from({length:17},(_,i)=>2010+i),anchorYears:[2011,2020,2026],sources:[{id:'source',m:'Progreso',p:[-89.5,21]}],anchors:[[0],[0],[0]],coordinate_scale:[100000,110000],source_hashes:{},municipalities:['Progreso'],targets:fixture().targets.map((r,i)=>({id:r.id,parent:r.id,m:'Progreso',p:[-89.5+i*.001,21],v:[0,1],type:'Playa',municipality_approximate:false,d:Array(17).fill(0),support:[[0],[0],[0]]}))};}
test('empty audit preserves complete input identity',()=>{
 const data=fixture();assert.strictEqual(applyCoastalAuditReview(data,null,sha),data);
 assert.strictEqual(applyCoastalAuditReview(data,undefined,sha),data);
 assert.strictEqual(applyCoastalAuditReview(data,review([]),sha),data);
});
test('one exact decision preserves other readings, manual history and explicit pending z18',()=>{
 const data=fixture(),before=structuredClone(data),pkg=review();
 const result=applyCoastalAuditReview(data,pkg,sha),changed=result.targets[0].readings[1];
 assert.deepEqual(data,before);assert.equal(result.field_validated,false);
 assert.strictEqual(result.targets[1],data.targets[1]);assert.strictEqual(result.targets[0].readings[0],data.targets[0].readings[0]);
 assert.strictEqual(result.targets[0].readings[2],data.targets[0].readings[2]);
 assert.equal(changed.offset_m,7);assert.equal(changed.accepted,true);assert.deepEqual(changed.releases,[201]);assert.deepEqual(changed.detail_offsets,[]);
 assert.deepEqual(changed.manual_review,{id:pkg.review_id,source:'A:1',uncertainty_m:4});
 assert.equal(changed.coastal_audit?.review_id,pkg.review_id);assert.equal(changed.coastal_audit?.timestamp,pkg.timestamp);
 assert.deepEqual(changed.coastal_audit?.history,[{manual_review:before.targets[0].readings[1].manual_review,offset_m:12,accepted:true,replaced_by:pkg.review_id,timestamp:pkg.timestamp}]);
 assert.deepEqual(result.targets[0].review_policy?.reviewed_captures,[{capture:0,releases:[101,102]},{capture:1,releases:[201]}]);
 pkg.decisions[0].evidence[0].path='changed-after-application';pkg.decisions[0].metadata!.checks[0].sensor='wrong';
 assert.equal(changed.coastal_audit?.evidence[0].path,'review/strip.jpg');assert.equal(changed.coastal_audit?.metadata?.checks[0].sensor,'WV03');validatePhotoCoast(result);
});
test('stale state, unknown keys, wrong date or edition fail atomically',()=>{
 const mutations:((d:CoastalAuditDecision)=>void)[]=[d=>{d.oldOffset=11;},d=>{d.oldAccepted=false;},d=>{d.profileId='missing';},d=>{d.capture=99;},d=>{d.date='2021-01-01';},d=>{d.sourceRelease=999;d.metadata!.release=999;}];
 for(const mutate of mutations){const data=fixture(),before=structuredClone(data),d=decision();mutate(d);assert.throws(()=>applyCoastalAuditReview(data,review([d]),sha),/Auditoría costera incompatible/);assert.deepEqual(data,before);}
 const data=fixture(),good=decision(),bad={...decision(),profileId:'missing'};
 assert.throws(()=>applyCoastalAuditReview(data,review([good,bad]),sha),/ausente/);assert.deepEqual(data,fixture());
 assert.throws(()=>applyCoastalAuditReview(data,review([good,good]),sha),/duplicada/);
 const first=applyCoastalAuditReview(data,review(),sha),same=review();same.decisions[0].oldOffset=7;
 assert.throws(()=>applyCoastalAuditReview(first,same,sha),/valores previos/);
});
test('package origin and field validation are checked even without decisions',()=>{
 for(const invalid of [{data_sha256:'d'.repeat(64)},{model_sha256:'d'.repeat(64)},{field_validated:true},{timestamp:'not-a-date'},{timestamp:'2026-11-09'},{review_id:''},{version:2}]){
  assert.throws(()=>applyCoastalAuditReview(fixture(),{...review([]),...invalid} as CoastalAuditReview,sha),/cabecera/);
 }
});
test('metadata binds position, date and sensor at the center and both sides',()=>{
 for(const deltas of [[-3,0,3],[-4,0,4],[-5,0,5],[-4,0,5]]){
  const d=decision();d.metadata!.checks=deltas.map(delta_m=>({delta_m,date:d.date,sensor:'WV03'}));
  assert.equal(applyCoastalAuditReview(fixture(),review([d]),sha).targets[0].readings[1].offset_m,7);
 }
 for(const deltas of [[-3,3],[-3,-2,3],[0,3,5],[-5,-3,0],[-3,0,0,3],[-3,0,NaN]]){
  const d=decision();d.metadata!.checks=deltas.map(delta_m=>({delta_m,date:d.date,sensor:'WV03'}));
  assert.throws(()=>applyCoastalAuditReview(fixture(),review([d]),sha),/metadatos/);
 }
 for(const mutate of [(d:CoastalAuditDecision)=>{d.metadata!.checks[0].date='2020-03-03';},(d:CoastalAuditDecision)=>{d.metadata!.checks[1].sensor='WV02';},(d:CoastalAuditDecision)=>{d.metadata!.positionOffset=8;},(d:CoastalAuditDecision)=>{d.metadata!.release=202;},(d:CoastalAuditDecision)=>{d.metadata=null;}]){
  const d=decision();mutate(d);assert.throws(()=>applyCoastalAuditReview(fixture(),review([d]),sha),/distintos|metadatos/);
 }
});
test('accepted values need an explicit uncertainty, visual interval and evidence hash',()=>{
 for(const mutation of [{newOffset:195},{newOffset:null},{positionVisualInterval:[8,10]},{positionVisualInterval:[3,6]},{positionVisualInterval:null},{uncertaintyM:0},{uncertaintyM:null},{uncertaintyM:Infinity},{evidence:[]},{evidence:[{path:'strip',sha256:'missing'}]}]){
  assert.throws(()=>applyCoastalAuditReview(fixture(),review([{...decision(),...mutation} as CoastalAuditDecision]),sha),/incompatible/);
 }
});
test('pending decisions remove the measurement and preserve the previous manual record',()=>{
 const d:CoastalAuditDecision={...decision(),newAccepted:false,newOffset:null,positionVisualInterval:null,uncertaintyM:null,metadata:null};
 const result=applyCoastalAuditReview(fixture(),review([d]),sha),r=result.targets[0].readings[1];
 assert.equal(r.offset_m,null);assert.equal(r.accepted,false);assert.equal(r.manual_review,undefined);assert.equal(r.detail_offsets,undefined);
 assert.deepEqual(r.releases,[201,202]);assert.deepEqual(r.reasons,['coastal_audit_review_pending']);assert.equal(r.coastal_audit?.history[0].manual_review?.id,'legacy');
 assert.deepEqual(result.targets[0].review_policy?.reviewed_captures,[{capture:0,releases:[101,102]}]);
 assert.throws(()=>applyCoastalAuditReview(fixture(),review([{...d,newOffset:7}]),sha),/rechazo/);
});
test('corrected fixed reference remains bound to its capture and verified edition',()=>{
 const row=applyCoastalAuditReview(fixture(),review([referenceDecision()]),sha).targets[0];
 assert.deepEqual(row.fixed_reference,{capture:0,method:'coastal-audit-fixture',source:'A:0',verified_release:101,method_url:'/data/audit/method.md'});
 assert.equal(row.readings[0].offset_m,2);assert.equal(row.review_policy?.reference_capture,0);assert.equal(row.reference_unavailable,undefined);
});
test('rejected fixed or policy reference stays missing without selecting another base',()=>{
 const d:CoastalAuditDecision={...referenceDecision(),newAccepted:false,newOffset:null,positionVisualInterval:null,uncertaintyM:null,metadata:null};
 for(const fixed of [true,false]){
  const data=fixture();if(!fixed)delete data.targets[0].fixed_reference;
  const result=applyCoastalAuditReview(data,review([d]),sha),row=result.targets[0];
  assert.equal(row.fixed_reference,undefined);assert.equal(row.reference_unavailable?.year,2011);assert.equal(row.reference_unavailable?.reason,d.reason);
  assert.equal(row.review_policy?.reference_capture,-1);assert.equal(row.readings[1].accepted,true);validatePhotoCoast(result);
 }
 const pkg=review([d]);delete pkg.method_url;assert.throws(()=>applyCoastalAuditReview(fixture(),pkg,sha),/referencia rechazada/);
});
test('explicit recovery expands the existing policy without approving other captures',()=>{
 const data=fixture(),d:CoastalAuditDecision={...decision(),capture:2,oldOffset:null,oldAccepted:false,newOffset:-11,sourceRelease:301,date:'2026-01-25',positionVisualInterval:[-15,-7],metadata:{release:301,positionOffset:-11,url:'https://example.test/metadata',sha256:evidenceSha,checks:[-3,0,3].map(delta_m=>({delta_m,date:'2026-01-25',sensor:'WV03'}))}};
 const result=applyCoastalAuditReview(data,review([d]),sha),policy=result.targets[0].review_policy!;
 assert.equal(policy.last_year,2026);assert.deepEqual(policy.reviewed_captures,[...data.targets[0].review_policy!.reviewed_captures!,{capture:2,releases:[301]}]);
 assert.equal(result.targets[0].readings[2].coastal_audit?.history.length,0);
 delete data.targets[0].review_policy;assert.equal(applyCoastalAuditReview(data,review([d]),sha).targets[0].review_policy,undefined);
});
test('legacy release policies retain previous approved captures when made explicit',()=>{
 const data=fixture();delete data.targets[0].review_policy!.reviewed_captures;
 assert.deepEqual(applyCoastalAuditReview(data,review(),sha).targets[0].review_policy!.reviewed_captures,[{capture:0,releases:[101,102]},{capture:1,releases:[201]}]);
});
test('a later distinct audit retains earlier manual history and source evidence',()=>{
 const first=applyCoastalAuditReview(fixture(),review(),sha),second=review();second.review_id='later-audit';second.decisions[0].oldOffset=7;
 const result=applyCoastalAuditReview(first,second,sha),history=result.targets[0].readings[1].coastal_audit!.history;
 assert.deepEqual(history.map(h=>h.manual_review?.id),['legacy','coastal-audit-fixture']);assert.equal(first.targets[0].readings[1].coastal_audit!.history.length,1);
 assert.equal(history[1].coastal_audit?.review_id,'coastal-audit-fixture');
 assert.deepEqual(history[1].coastal_audit?.evidence,first.targets[0].readings[1].coastal_audit?.evidence);
 assert.deepEqual(history[1].coastal_audit?.metadata,first.targets[0].readings[1].coastal_audit?.metadata);
 assert.deepEqual(history[1].coastal_audit?.position_visual_interval_m,[3,11]);
 assert.equal('history' in history[1].coastal_audit!,false);
});
test('audit display keeps the same observation in HD and explicitly leaves detail unverified',()=>{
 const data=applyCoastalAuditReview(fixture(),review(),sha),cache=createCoastalImageAlignment(model(),data);
 const standard=cache.read(2020,201,17).layer.features.find(f=>f.id==='A')!;
 assert.equal(standard.properties.photo_audit_preserve_control,true);assert.equal(standard.properties.photo_review_tile_zoom,17);
 for(const zoom of [18,19]){
  const hd=cache.read(2020,201,zoom).layer.features.find(f=>f.id==='A')!;
  assert.deepEqual(hd.geometry,standard.geometry);assert.equal(hd.properties.delta_m,standard.properties.delta_m);
  assert.equal(hd.properties.photo_detail_review_pending,true);assert.equal(hd.properties.photo_review_tile_zoom,17);
 }
 assert.equal(standard.properties.photo_detail_review_pending,undefined);assert.deepEqual(data.targets[0].readings[1].detail_offsets,[]);
 const wrongEdition=cache.read(2020,202,18).layer.features.find(f=>f.id==='A')!;
 assert.equal(wrongEdition.properties.photo_audit_preserve_control,undefined);assert.equal(wrongEdition.properties.photo_interpretation,false);
 assert.equal(coastalAuditForReading(data.targets[0].readings[1],202),null);
});
test('both display routes preserve an audited endpoint or baseline without protecting neighbours',()=>{
 for(const d of [decision(),referenceDecision()]){
  const data=applyCoastalAuditReview(fixture(),review([d]),sha);
  const layers=[createCoastalImageAlignment(model(),data).read(2020,201).layer,photoCoastComparison(model(),data,2011,2020,201)];
  for(const layer of layers){assert.equal(layer.features.find(f=>f.id==='A')?.properties.photo_audit_preserve_control,true);assert.equal(layer.features.find(f=>f.id==='IXIL-PROTECTED')?.properties.photo_audit_preserve_control,undefined);}
 }
});
test('equivalent mosaics keep the corrected position with their own metadata',()=>{
 const d=decision(), metadata=structuredClone(d.metadata!);
 d.equivalentMetadata=[{...metadata,release:202,url:'https://example.test/equivalent-metadata'}];
 const corrected=applyCoastalAuditReview(fixture(),review([d]),sha);
 const reading=corrected.targets[0].readings[1];
 assert.deepEqual(reading.releases,[201,202]);
 assert.deepEqual(corrected.targets[0].review_policy?.reviewed_captures?.[1],{capture:1,releases:[201,202]});
 assert.equal(coastalAuditForReading(reading,202)?.metadata?.url,'https://example.test/equivalent-metadata');
 assert.equal(coastalAuditForReading(reading,203),null);
 const cache=createCoastalImageAlignment(model(),corrected);
 assert.deepEqual(cache.read(2020,201).layer.features.find(f=>f.id==='A')?.geometry,
  cache.read(2020,202).layer.features.find(f=>f.id==='A')?.geometry);
 for(const invalid of [
  {...metadata,release:201},
  {...metadata,release:203},
  {...metadata,release:202,positionOffset:8},
  {...metadata,release:202,checks:[{delta_m:0,date:d.date,sensor:'WV03'}]},
  {...metadata,release:202,checks:metadata.checks.map(c=>({...c,sensor:'WV02'}))},
 ]){
  assert.throws(()=>applyCoastalAuditReview(fixture(),review([{...d,equivalentMetadata:[invalid]}]),sha),/Auditoría costera incompatible/);
 }
});
test('a newly identified edition needs a matching raster and an unassigned capture',()=>{
 const d=decision();
 const match={evidence:d.evidence[0],correlation:.999,mean_rgb_error:2};
 const metadata={...d.metadata!,release:203,imagery_match:match};
 const revised=applyCoastalAuditReview(fixture(),review([{...d,equivalentMetadata:[metadata]}]),sha);
 assert.deepEqual(revised.targets[0].readings[1].releases,[201,203]);
 for(const invalid of [
  {...metadata,release:301},
  {...metadata,imagery_match:{...match,correlation:.97}},
  {...metadata,imagery_match:{...match,evidence:{...match.evidence,path:'unrelated.jpg'}}},
 ]){
  assert.throws(()=>applyCoastalAuditReview(fixture(),review([{...d,equivalentMetadata:[invalid]}]),sha),/edición equivalente ajena/);
 }
});
test('a rejected audit stays pending even without an older municipal policy',()=>{
 const raw=fixture();delete raw.targets[0].review_policy;
 const d:CoastalAuditDecision={...decision(),newAccepted:false,newOffset:null,positionVisualInterval:null,uncertaintyM:null,metadata:null};
 const data=applyCoastalAuditReview(raw,review([d]),sha),f=createCoastalImageAlignment(model(),data).read(2020,201).layer.features.find(f=>f.id==='A')!;
 assert.equal(f.properties.photo_audit_preserve_control,true);assert.equal(f.geometry.type,'Point');assert.equal(f.properties.delta_m,null);
 assert.equal(f.properties.photo_review_pending,true);assert.equal(f.properties.trajectory_estimate,undefined);
});
test('new metadata supersedes only the explicitly rechecked source endpoint',()=>{
 const data=applyCoastalAuditReview(fixture(),review(),sha),sources={version:1,algorithm:'source-aware-photo-anchors-v1',model_sha256:modelSha,data_sha256:sha,blocked:['A','IXIL-PROTECTED'].map(profile_id=>({profile_id,release:201,kind:'photo',actual:null,position:[-89.5,21],reason:'old_source_issue'}))};
 const layer=createCoastalImageAlignment(model(),data,sources).read(2020,201).layer;
 assert.equal(layer.features.find(f=>f.id==='A')?.properties.photo_interpretation,true);
 assert.equal(layer.features.find(f=>f.id==='IXIL-PROTECTED')?.properties.photo_interpretation,false);
 const raw=fixture();delete raw.targets[0].review_policy;
 const explicit=applyCoastalAuditReview(raw,review(),sha);
 const comparison=compatibleSourceLayer(photoCoastComparison(model(),explicit,2011,2020,201),201,sources);
 assert.equal(comparison.features.some(f=>f.id==='A'),true);assert.equal(comparison.features.some(f=>f.id==='IXIL-PROTECTED'),false);
});
test('shared integration applies the explicit audit after all previous reviews merge',async()=>{
 const read=(p:string)=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
 const dir='public/data/shorelines/photo-alignment/';
 const originalSha=createHash('sha256').update(readFileSync(new URL('../'+dir+'revised-data.json',import.meta.url))).digest('hex');
 const initial=applyPhotoDigitization(applyPhotoVisualReview(validatePhotoCoast(read(dir+'revised-data.json')),read(dir+'revised-visual-review.json'),originalSha),read(dir+'manual-digitization-20261103.json'),originalSha);
 const load=async(url:string)=>read('public'+url),base=await applyIntegratedPhotoReviews(initial,originalSha,load,null);
 const target=base.targets.find((row,i)=>row.readings.some(r=>r.accepted&&r.offset_m!==null&&Math.abs(r.offset_m)<190&&r.offset_m!==initial.targets[i].readings.find(old=>old.capture===r.capture)?.offset_m))!;
 const r=target.readings.find(r=>r.accepted&&r.offset_m!==null&&Math.abs(r.offset_m)<190&&r.offset_m!==initial.targets.find(row=>row.id===target.id)!.readings.find(old=>old.capture===r.capture)?.offset_m)!;
 const c=base.captures[r.capture],value=r.offset_m!+.5,d:CoastalAuditDecision={...decision(),profileId:target.id,capture:r.capture,oldOffset:r.offset_m,oldAccepted:r.accepted,newOffset:value,sourceRelease:r.releases[0],date:c.date,positionVisualInterval:[value-1,value+1],metadata:{release:r.releases[0],positionOffset:value,url:'https://example.test/integration-only-fixture',sha256:evidenceSha,checks:[-3,0,3].map(delta_m=>({delta_m,date:c.date,sensor:c.source}))}};
 const pkg={...review([d]),data_sha256:originalSha,model_sha256:base.model_sha256};
 const result=await applyIntegratedPhotoReviews(initial,originalSha,load,pkg) as CoastalAuditData;
 const changed=result.targets.find(row=>row.id===target.id)!.readings.find(item=>item.capture===r.capture)!;
 assert.equal(changed.offset_m,value);assert.equal(changed.coastal_audit?.old_offset_m,r.offset_m);
 for(let i=0;i<base.targets.length;i++)if(base.targets[i].id!==target.id)assert.deepEqual(result.targets[i],base.targets[i]);
 assert.throws(()=>applyCoastalAuditReview(initial,pkg,originalSha),/valores previos/);
});

