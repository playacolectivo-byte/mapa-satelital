import {applyPhotoDigitization,type PhotoDigitization} from './photo-digitization.ts';
import type {PhotoCoastData} from './photo-coast.ts';
import type {MunicipalPhotoCatalogue} from './coastal-photo-scopes.ts';

export type PhotoPilotReview=PhotoDigitization&{
 reference_date:string;reference_capture:number;profile_ids:string[];
 first_year:number;last_year:number;reviewed_releases:number[];
};

/** A bounded, dated review cannot lend its baseline to another profile or
 * certify an unreviewed year/edition. Original source files remain unchanged. */
export function applyPhotoPilotReview(data:PhotoCoastData,review:PhotoPilotReview,dataSha:string):PhotoCoastData{
 if(data.captures[review.reference_capture]?.date!==review.reference_date||Number(review.reference_date.slice(0,4))!==review.first_year||review.last_year<review.first_year||new Set(review.profile_ids).size!==review.profile_ids.length||!review.reviewed_releases.length)throw new Error('Alcance de revisión incompatible');
 const ids=new Set(review.profile_ids);
 if(review.corrections.some(c=>!ids.has(c.profile_id))||review.profile_ids.some(id=>!review.corrections.some(c=>c.profile_id===id&&c.capture===review.reference_capture)))throw new Error('Falta una referencia revisada por perfil');
 const result=applyPhotoDigitization(data,review,dataSha);
 let found=0;
 const targets=result.targets.map(t=>{
  if(!ids.has(t.id))return t;
  found++;
  return {...t,review_policy:{method:review.method,reference_capture:review.reference_capture,first_year:review.first_year,last_year:review.last_year,reviewed_releases:[...review.reviewed_releases]}};
 });
 if(found!==ids.size)throw new Error('Faltan perfiles de la revisión');
 return {...result,targets};
}

export function withPhotoPilotCatalogue(base:MunicipalPhotoCatalogue,addition:Pick<MunicipalPhotoCatalogue,'captures'|'compatible_captures'|'anchors'>):MunicipalPhotoCatalogue{
 const ids=new Set(addition.captures.map(c=>c.profile_id));
 return {...base,captures:[...base.captures.filter(c=>!ids.has(c.profile_id)),...addition.captures],compatible_captures:[...base.compatible_captures.filter(c=>!ids.has(c.profile_id)),...addition.compatible_captures],anchors:[...base.anchors.filter(a=>!ids.has(a.profile_id)),...addition.anchors]};
}
