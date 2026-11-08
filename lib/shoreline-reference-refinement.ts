import {applyPhotoDigitization,type PhotoDigitization} from './photo-digitization.ts';
import type {PhotoCoastData} from './photo-coast.ts';

type UninterpretableReference={profile_id:string;capture:number;reason:string;original_offset_m:number|null;original_accepted:boolean};
export type ShorelineReferenceRefinement=PhotoDigitization&{status:string;reference_year:2011;uninterpretable_references?:UninterpretableReference[]};

/** Correct only an explicitly inspected 2011 reference. All other acquired
 * positions, approvals and original source observations stay unchanged. */
export function applyShorelineReferenceRefinement(data:PhotoCoastData,review:ShorelineReferenceRefinement,sha:string):PhotoCoastData{
 if(review.status!=='independently_reviewed'||review.reference_year!==2011||review.corrections.some(c=>!c.date.startsWith('2011-')||!review.sources.some(s=>s.id===c.source&&s.capture_date===c.date)))throw new Error('Referencia refinada sin revisión compatible');
 const corrected=applyPhotoDigitization(data,review,sha),changes=new Map(review.corrections.map(c=>[c.profile_id,c]));
 const gaps=new Map((review.uninterpretable_references??[]).map(c=>[c.profile_id,c])),oldRows=new Map(data.targets.map(t=>[t.id,t]));
 if(changes.size!==review.corrections.length||gaps.size!==(review.uninterpretable_references??[]).length||[...gaps.keys()].some(id=>changes.has(id)||!oldRows.has(id)))throw new Error('Más de una referencia por perfil');
 return {...corrected,targets:corrected.targets.map(t=>{
  const c=changes.get(t.id),gap=gaps.get(t.id);if(!c&&!gap)return t;
  const old=oldRows.get(t.id)!,capture=c?.capture??gap!.capture;
  if(old.fixed_reference&&old.fixed_reference.capture!==capture)throw new Error('La corrección no puede cambiar la captura de referencia');
  if(!old.review_policy?.reviewed_captures)throw new Error('Perfil sin política de revisión explícita');
  const captures=old.review_policy.reviewed_captures.filter(r=>r.capture!==capture);
  const target={...t};delete target.reference_unavailable;delete target.fixed_reference;
  const methodUrl='/data/shorelines/photo-alignment/reference-refinement-20261106-method.md';
  const source=c?review.sources.find(s=>s.id===c.source)!:null;
  if(source)captures.push({capture,releases:[source.release]});
  const policy={...old.review_policy,method:review.method,reference_capture:gap?-1:capture,reviewed_captures:captures,reviewed_releases:[...new Set(captures.flatMap(r=>r.releases))],method_url:methodUrl};
  if(gap){
   const previous=old.readings.find(r=>r.capture===capture);
   if(!previous||previous.offset_m!==gap.original_offset_m||previous.accepted!==gap.original_accepted||!data.captures[capture]?.date.startsWith('2011-')||!gap.reason)throw new Error('Referencia pendiente de otra versión');
   return {...target,reference_unavailable:{year:2011,reason:gap.reason,method:review.method,method_url:methodUrl},review_policy:policy};
  }
  return {...target,fixed_reference:{capture,method:review.method,source:source!.id,verified_release:source!.release,method_url:methodUrl},review_policy:policy};
 })};
}
