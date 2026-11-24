import {applyPhotoDigitization,type PhotoDigitization} from './photo-digitization.ts';
import {validatePhotoCoast,type PhotoCoastData,type PhotoCoastReading} from './photo-coast.ts';

type ReferenceDecision={profile_id:string;capture:number;release:number}|{profile_id:string;reason:string};
type WithheldReading={profile_id:string;capture:number;release:number;reason:string};

export type CoastalMunicipalRefinement=Omit<PhotoDigitization,'corrections'>&{
 status:'independently_reviewed';
 method_url:string;
 last_year:number;
 references:ReferenceDecision[];
 withheld?:WithheldReading[];
 auxiliary_beach_controls?:string[];
 corrections:(PhotoDigitization['corrections'][number]&{additional_sources?:string[]})[];
};

/** Refine a fixed 2011 reference and extend the explicit annual approvals.
 * Earlier observations and release approvals survive unless reviewed here. */
export function applyCoastalMunicipalRefinement(data:PhotoCoastData,review:CoastalMunicipalRefinement,sha:string):PhotoCoastData{
 if(review.status!=='independently_reviewed'||!Number.isInteger(review.last_year)||review.last_year<2011||!review.method_url)throw new Error('Revisión costera incompleta');
 const references=new Map(review.references.map(r=>[r.profile_id,r]));
 if(references.size!==review.references.length)throw new Error('Referencia costera duplicada');
 const auxiliary=new Set(review.auxiliary_beach_controls??[]);
 if([...auxiliary].some(id=>!references.has(id)||'reason' in references.get(id)!))throw new Error('Perfil auxiliar sin contacto observado');
 const sources=new Map(review.sources.map(s=>[s.id,s]));
 const corrections=new Map<string,typeof review.corrections>();
 const withheld=new Map<string,WithheldReading[]>();
 for(const change of review.corrections){
  const rows=corrections.get(change.profile_id)??[];
  rows.push(change);
  corrections.set(change.profile_id,rows);
 }
 for(const decision of review.withheld??[]){
  if(!decision.reason||!data.captures[decision.capture])throw new Error('Exclusión costera inválida');
  const rows=withheld.get(decision.profile_id)??[];
  rows.push(decision);
  withheld.set(decision.profile_id,rows);
 }
 for(const id of [...references.keys(),...corrections.keys(),...withheld.keys()]){
  if(!data.targets.some(t=>t.id===id))throw new Error('Perfil de revisión desconocido');
 }
 const corrected=applyPhotoDigitization(data,review,sha);
 const targets=corrected.targets.map((target,i)=>{
  const reference=references.get(target.id),changes=corrections.get(target.id)??[],excluded=withheld.get(target.id)??[];
  if(!reference&&!changes.length&&!excluded.length)return target;
  const old=data.targets[i];
  const approvals=new Map<number,Set<number>>();
  for(const approval of old.review_policy?.reviewed_captures??[]){
   const releases=approvals.get(approval.capture)??new Set<number>();
   approval.releases.forEach(release=>releases.add(release));
   approvals.set(approval.capture,releases);
  }
  for(const change of changes){
   const verified=new Set<number>();
   for(const id of [change.source,...(change.additional_sources??[])]){
    const source=sources.get(id);
    if(!source||source.capture_date!==change.date||!change.releases.includes(source.release)||!/^[a-f0-9]{64}$/.test(source.screenshot_sha256)){
     throw new Error('Edición adicional sin fuente verificada');
    }
    verified.add(source.release);
   }
   const releases=approvals.get(change.capture)??new Set<number>();
   if(change.offset_m!==change.original_offset_m&&[...releases].some(release=>!verified.has(release)&&!excluded.some(e=>e.capture===change.capture&&e.release===release))){
    throw new Error('El ajuste cambiaría una lectura aprobada en otra edición');
   }
   for(const release of verified)releases.add(release);
   approvals.set(change.capture,releases);
  }
  for(const item of excluded)approvals.get(item.capture)?.delete(item.release);
  const referenceReading=(capture:number,release:number):PhotoCoastReading=>{
   const reading=target.readings.find(r=>r.capture===capture&&r.releases.includes(release));
   if(!reading?.accepted||!reading.manual_review||!data.captures[capture]?.date.startsWith('2011-')||!approvals.get(capture)?.has(release)){
    throw new Error('Referencia sin lectura de 2011 verificada');
   }
   return reading;
  };
  let fixed=old.fixed_reference,gap=old.reference_unavailable;
  if(reference){
   if('reason' in reference){
    if(!reference.reason)throw new Error('Referencia pendiente sin motivo');
    if(fixed)approvals.delete(fixed.capture);
    fixed=undefined;
    gap={year:2011,reason:reference.reason,method:review.method,method_url:review.method_url};
   }else{
    const reading=referenceReading(reference.capture,reference.release);
    fixed={capture:reference.capture,verified_release:reference.release,source:reading.manual_review!.source,method:reading.manual_review!.id,method_url:review.method_url};
    gap=undefined;
   }
  }
  if(fixed){
   const reading=referenceReading(fixed.capture,fixed.verified_release);
   fixed={...fixed,method:reading.manual_review!.id,source:reading.manual_review!.source};
  }else if(!gap)throw new Error('Perfil de revisión sin decisión de referencia');
  const reviewed_captures=[...approvals].filter(([,releases])=>releases.size).map(([capture,releases])=>({capture,releases:[...releases]}));
  return {
   ...target,
   ...(auxiliary.has(target.id)?{reviewed_beach_control:true as const}:{}),
   fixed_reference:fixed,
   reference_unavailable:gap,
   review_policy:{
    method:review.method,method_url:review.method_url,reference_capture:fixed?.capture??-1,
    first_year:2011,last_year:Math.max(review.last_year,old.review_policy?.last_year??2011),
    reviewed_captures,reviewed_releases:[...new Set(reviewed_captures.flatMap(r=>r.releases))],
   },
  };
 });
 return validatePhotoCoast({...corrected,targets});
}
