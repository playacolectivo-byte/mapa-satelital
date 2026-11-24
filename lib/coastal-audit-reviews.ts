import {validatePhotoCoast,type PhotoCoastData,type PhotoCoastReading,type PhotoCoastTarget} from './photo-coast.ts';

export type CoastalAuditEvidence={path:string;sha256:string};
export type CoastalAuditMetadata={
 release:number;positionOffset:number;url:string;sha256:string;
 checks:{delta_m:number;date:string|null;sensor:string|null}[];
 imagery_match?:{evidence:CoastalAuditEvidence;correlation:number;mean_rgb_error:number};
};
export type CoastalAuditDecision={
 profileId:string;capture:number;oldOffset:number|null;oldAccepted:boolean;
 newOffset:number|null;newAccepted:boolean;sourceRelease:number;date:string;
 /** Absolute offsets on the original profile; an interpretation interval,
  * not an estimate of total physical or georeferencing uncertainty. */
 positionVisualInterval:[number,number]|null;uncertaintyM:number|null;
 evidence:CoastalAuditEvidence[];metadata:CoastalAuditMetadata|null;equivalentMetadata?:CoastalAuditMetadata[];reason:string;
};
export type CoastalAuditReview={
 version:1;field_validated:false;review_id:string;timestamp:string;
 data_sha256:string;model_sha256:string;method_url?:string;
 decisions:CoastalAuditDecision[];
};
type ManualReview=NonNullable<PhotoCoastReading['manual_review']>;
export type CoastalAuditProvenance={
 review_id:string;timestamp:string;date:string;source_release:number;
 old_offset_m:number|null;old_accepted:boolean;
 position_visual_interval_m:[number,number]|null;
 evidence:CoastalAuditEvidence[];metadata:CoastalAuditMetadata|null;equivalent_metadata?:CoastalAuditMetadata[];reason:string;
 method_url?:string;
 history:{manual_review?:ManualReview;coastal_audit?:Omit<CoastalAuditProvenance,'history'>;offset_m:number|null;accepted:boolean;replaced_by:string;timestamp:string}[];
};
export type CoastalAuditReading=PhotoCoastReading&{coastal_audit?:CoastalAuditProvenance};
export type CoastalAuditData=Omit<PhotoCoastData,'targets'>&{
 targets:(Omit<PhotoCoastTarget,'readings'>&{readings:CoastalAuditReading[]})[];
};

const text=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0;
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const offset=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<195;
function fail(reason:string):never{throw new Error('Auditoría costera incompatible: '+reason);}
function validMetadata(m:CoastalAuditMetadata|null,position:number): m is CoastalAuditMetadata{
 return !!m&&Number.isInteger(m.release)&&m.release>0&&m.positionOffset===position&&text(m.url)&&hash(m.sha256)&&
  Array.isArray(m.checks)&&m.checks.length>=3&&m.checks.every(c=>!!c&&Number.isFinite(c.delta_m))&&
  new Set(m.checks.map(c=>c.delta_m)).size===m.checks.length&&
  m.checks.some(c=>c.delta_m===0)&&m.checks.some(c=>c.delta_m<0)&&m.checks.some(c=>c.delta_m>0);
}
function validateDecision(d:CoastalAuditDecision){
 if(!d||!text(d.profileId)||!Number.isInteger(d.capture)||d.capture<0||
  d.oldOffset!==null&&!Number.isFinite(d.oldOffset)||typeof d.oldAccepted!=='boolean'||
  typeof d.newAccepted!=='boolean'||!Number.isInteger(d.sourceRelease)||d.sourceRelease<=0||
  !text(d.date)||!text(d.reason)||!Array.isArray(d.evidence)||!d.evidence.length||
  d.evidence.some(e=>!e||!text(e.path)||!hash(e.sha256)))fail('decisión o evidencia inválida');
 if(!d.newAccepted){
  if(d.newOffset!==null||d.positionVisualInterval!==null||d.equivalentMetadata!==undefined)fail('rechazo con posición aceptada');
  return;
 }
 const range=d.positionVisualInterval,m=d.metadata;
 if(!offset(d.newOffset)||typeof d.uncertaintyM!=='number'||!Number.isFinite(d.uncertaintyM)||d.uncertaintyM<=0||
  !Array.isArray(range)||range.length!==2||!range.every(offset)||range[0]>d.newOffset||range[1]<d.newOffset)fail('posición o incertidumbre inválida');
 if(!validMetadata(m,d.newOffset)||m.release!==d.sourceRelease)fail('metadatos sin centro y ambos lados');
 const equivalent=d.equivalentMetadata;
 if(equivalent!==undefined&&(!Array.isArray(equivalent)||!equivalent.length||
  equivalent.some(entry=>!validMetadata(entry,d.newOffset!)||entry.release===d.sourceRelease)||
  new Set(equivalent.map(entry=>entry.release)).size!==equivalent.length))fail('ediciones equivalentes inválidas');
}

/** Apply only explicit decisions against the final, merged pre-review values.
 * The original source SHA remains the package identity; exact old values guard
 * against silently overwriting a newer review. No package means no changes. */
export function applyCoastalAuditReview(data:PhotoCoastData,review:CoastalAuditReview|null|undefined,originalSha:string):CoastalAuditData{
 if(review==null)return data;
 if(review.version!==1||review.field_validated!==false||!text(review.review_id)||
  !text(review.timestamp)||!review.timestamp.includes('T')||!Number.isFinite(Date.parse(review.timestamp))||
  !hash(review.data_sha256)||review.data_sha256!==originalSha||!hash(review.model_sha256)||review.model_sha256!==data.model_sha256||
  !Array.isArray(review.decisions)||review.method_url!==undefined&&!text(review.method_url))fail('cabecera o huellas de origen');
 const decisions=new Map<string,Map<number,CoastalAuditDecision>>();
 for(const d of review.decisions){
  validateDecision(d);
  const captures=decisions.get(d.profileId)??new Map<number,CoastalAuditDecision>();
  if(captures.has(d.capture))fail('decisión duplicada');
  captures.set(d.capture,d);decisions.set(d.profileId,captures);
 }
 if(!review.decisions.length)return data;
 let applied=0;
 const targets=data.targets.map((row):CoastalAuditData['targets'][number]=>{
  const changes=decisions.get(row.id);if(!changes)return row;
  const seen=new Set<number>();
  const readings=row.readings.map((reading):CoastalAuditReading=>{
   const d=changes.get(reading.capture);if(!d)return reading;
   if(seen.has(reading.capture))fail('captura repetida en el inventario');seen.add(reading.capture);
   const capture=data.captures[reading.capture],previous=(reading as CoastalAuditReading).coastal_audit;
   if(!capture||reading.offset_m!==d.oldOffset||reading.accepted!==d.oldAccepted||capture.date!==d.date||
    !reading.releases.includes(d.sourceRelease)||previous?.review_id===review.review_id)fail('valores previos distintos: '+row.id+':'+reading.capture);
   const equivalent=d.equivalentMetadata??[];
   if(equivalent.some(m=>{
    if(reading.releases.includes(m.release))return false;
    const match=m.imagery_match;
    return !match||!Number.isFinite(match.correlation)||match.correlation<.99||match.correlation>1||
     !Number.isFinite(match.mean_rgb_error)||match.mean_rgb_error<0||match.mean_rgb_error>5||
     !d.evidence.some(e=>e.path===match.evidence?.path&&e.sha256===match.evidence?.sha256)||
     row.readings.some(other=>other.capture!==d.capture&&other.releases.includes(m.release));
   }))fail('edición equivalente ajena a la observación: '+row.id+':'+reading.capture);
   if(d.newAccepted&&[d.metadata!,...equivalent].some(m=>m.checks.some(c=>c.date!==capture.date||c.sensor!==capture.source)))
    fail('fecha o sensor distintos: '+row.id+':'+reading.capture);
   const source=row.id+':'+reading.capture;
   const history=structuredClone(previous?.history??[]);
   if(reading.manual_review||previous){
    const prior=previous?structuredClone(previous):undefined;
    if(prior)delete (prior as Partial<CoastalAuditProvenance>).history;
    history.push({...(reading.manual_review?{manual_review:{...reading.manual_review}}:{}),...(prior?{coastal_audit:prior}:{}),
     offset_m:reading.offset_m,accepted:reading.accepted,replaced_by:review.review_id,timestamp:review.timestamp});
   }
   const next:CoastalAuditReading={...reading,offset_m:d.newOffset,accepted:d.newAccepted,reasons:d.newAccepted?[]:['coastal_audit_review_pending'],
    coastal_audit:{review_id:review.review_id,timestamp:review.timestamp,date:d.date,source_release:d.sourceRelease,
     old_offset_m:d.oldOffset,old_accepted:d.oldAccepted,position_visual_interval_m:d.positionVisualInterval? [...d.positionVisualInterval]:null,
     evidence:structuredClone(d.evidence),metadata:structuredClone(d.metadata),...(equivalent.length?{equivalent_metadata:structuredClone(equivalent)}:{}),reason:d.reason,...(review.method_url?{method_url:review.method_url}:{}),history}};
   if(d.newAccepted){
    next.manual_review={id:review.review_id,source,uncertainty_m:d.uncertaintyM!};
    // Use only the mosaics evidenced at z17. The empty detail list keeps
    // the offset from being counted as a separately reviewed z18 crossing.
    next.releases=[d.sourceRelease,...equivalent.map(m=>m.release)];next.detail_offsets=[];
   }else{delete next.manual_review;delete next.detail_offsets;}
   applied++;return next;
  });
  const next:CoastalAuditData['targets'][number]={...row,readings};
  const referenceCapture=row.fixed_reference?.capture??row.review_policy?.reference_capture;
  const referenceChange=referenceCapture===undefined?undefined:changes.get(referenceCapture);
  if(referenceChange&&!referenceChange.newAccepted){
   if(!referenceChange.date.startsWith('2011-')||!review.method_url)fail('referencia rechazada sin contrato de ausencia de 2011');
   delete next.fixed_reference;
   next.reference_unavailable={year:2011,reason:referenceChange.reason,method:review.review_id,method_url:review.method_url};
  }else if(referenceChange&&row.fixed_reference){
   next.fixed_reference={...row.fixed_reference,method:review.review_id,source:row.id+':'+referenceCapture,
    verified_release:referenceChange.sourceRelease,...(review.method_url?{method_url:review.method_url}:{})};
  }
  if(row.review_policy){
   const policy=row.review_policy;
   // Expand a legacy release list into its previously approved readings,
   // then replace only the captures explicitly included in this package.
   const old=policy.reviewed_captures??row.readings.filter(r=>r.accepted&&
    (r.manual_review?.id===policy.method||r.capture===row.fixed_reference?.capture)).map(r=>({capture:r.capture,releases:r.releases.filter(v=>policy.reviewed_releases.includes(v))})).filter(r=>r.releases.length);
   const reviewed=new Map(old.map(r=>[r.capture,{capture:r.capture,releases:[...r.releases]}]));
   for(const d of changes.values()){
    if(d.newAccepted)reviewed.set(d.capture,{capture:d.capture,releases:[d.sourceRelease,...(d.equivalentMetadata??[]).map(m=>m.release)]});else reviewed.delete(d.capture);
   }
   const years=[...changes.values()].filter(d=>d.newAccepted).map(d=>Number(d.date.slice(0,4)));
   next.review_policy={...policy,reference_capture:referenceChange&&!referenceChange.newAccepted?-1:policy.reference_capture,
    first_year:Math.min(policy.first_year,...years),last_year:Math.max(policy.last_year,...years),
    reviewed_captures:[...reviewed.values()].sort((a,b)=>a.capture-b.capture),
    reviewed_releases:[...new Set([...reviewed.values()].flatMap(r=>r.releases))].sort((a,b)=>a-b)};
  }
  return next;
 });
 if(applied!==review.decisions.length)fail('perfil o captura ausente');
 const result={...data,targets};validatePhotoCoast(result);return result;
}
