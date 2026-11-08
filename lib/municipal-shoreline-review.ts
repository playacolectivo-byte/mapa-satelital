import {applyPhotoDigitization,type PhotoDigitization} from './photo-digitization.ts';
import type {PhotoCoastData} from './photo-coast.ts';

export type MunicipalShorelineReview=PhotoDigitization&{
 status:string;reference_year:number;reference_captures:{profile_id:string;capture:number;date:string}[];
 reference_gaps:{profile_id:string;year:number;reason:string}[];
 reviewed_readings?:{profile_id:string;capture:number;releases:number[];visual_status:'accepted';offset_m?:number;source?:string;manual_uncertainty_m?:number}[];
 rejected_readings:{profile_id:string;capture:number;reason:string;releases?:number[]}[];
};

/** A dated visual review approves only its explicit intersections. A missing
 * 2011 photograph cannot be replaced by a reconstructed 2010/2011 baseline. */
export function applyMunicipalShorelineReview(data:PhotoCoastData,review:MunicipalShorelineReview,sha:string):PhotoCoastData{
 if(review.status!=='independently_reviewed'||review.reference_year!==2011)throw new Error('Revisión municipal pendiente');
 const refs=new Map(review.reference_captures.map(r=>[r.profile_id,r]));
 const gaps=new Map(review.reference_gaps.map(r=>[r.profile_id,r]));
 if(refs.size!==review.reference_captures.length||gaps.size!==review.reference_gaps.length||[...refs.keys()].some(id=>gaps.has(id)))throw new Error('Alcance municipal duplicado');
 const scope=new Set([...refs.keys(),...gaps.keys()]);
 if(review.reference_gaps.some(r=>r.year!==2011||!r.reason)||[...review.corrections,...(review.reviewed_readings??[]),...review.rejected_readings].some(r=>!scope.has(r.profile_id)))throw new Error('Lectura fuera del alcance municipal');
 const corrected=applyPhotoDigitization(data,review,sha);
 const rejected=review.rejected_readings;
 const approved=[...review.corrections.map(c=>({profile_id:c.profile_id,capture:c.capture,releases:[review.sources.find(s=>s.id===c.source)!.release]})),...(review.reviewed_readings??[])];
 const methodUrl='/data/shorelines/photo-alignment/municipal-review-20261105-method.md';
 const found=new Set<string>();
 const targets=corrected.targets.map(t=>{
  const ref=refs.get(t.id),gap=gaps.get(t.id);if(!ref&&!gap)return t;found.add(t.id);
  const baseTarget={...t};delete baseTarget.fixed_reference;delete baseTarget.reference_unavailable;
  const readings=t.readings.map(original=>{
   const checked=review.reviewed_readings?.find(x=>x.profile_id===t.id&&x.capture===original.capture);
   if(checked?.offset_m!==undefined&&checked.offset_m!==original.offset_m)throw new Error('La posición confirmada cambió');
   // An unchanged position has undergone the same visual interpretation. Its
   // stated tolerance must not revert to the previous detector's spread.
   const r=checked&&ref?.capture!==original.capture?{...original,manual_review:{id:review.method,source:checked.source??'reviewed-reading:'+t.id+':'+original.capture,uncertainty_m:checked.manual_uncertainty_m??8}}:original;
   const excluded=rejected.filter(x=>x.profile_id===t.id&&x.capture===r.capture);if(!excluded.length)return r;
   const releases=r.releases.filter(v=>!excluded.some(x=>!x.releases||x.releases.includes(v)));
   return releases.length?{...r,releases}:{...r,accepted:false,reasons:[...new Set([...r.reasons,...excluded.map(x=>x.reason)])]};
  });
  const captures=approved.filter(r=>r.profile_id===t.id);
  for(const r of captures){const match=readings.find(x=>x.capture===r.capture);if(!match?.accepted||r.releases.some(v=>!match.releases.includes(v)))throw new Error('Lectura municipal no aceptada');}
  const policy={method:review.method,reference_capture:ref?.capture??-1,first_year:2011,last_year:2025,reviewed_releases:[...new Set(captures.flatMap(r=>r.releases))],reviewed_captures:captures.map(({capture,releases})=>({capture,releases})),method_url:methodUrl};
  if(gap)return {...baseTarget,readings,reference_unavailable:{year:2011,reason:gap.reason,method:review.method,method_url:methodUrl},review_policy:policy};
  const reading=readings.find(r=>r.capture===ref!.capture),source=review.sources.find(s=>s.id===reading?.manual_review?.source);
  if(!reading?.accepted||!source||data.captures[ref!.capture]?.date!==ref!.date||!ref!.date.startsWith('2011-'))throw new Error('Referencia municipal sin fotografía de 2011');
  return {...baseTarget,readings,fixed_reference:{capture:ref!.capture,method:reading.manual_review!.id,source:source.id,verified_release:source.release,method_url:methodUrl},review_policy:policy};
 });
 if(found.size!==refs.size+gaps.size)throw new Error('Faltan perfiles municipales');
 return {...corrected,targets};
}
