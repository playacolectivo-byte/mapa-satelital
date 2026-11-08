import {applyPhotoDigitization,type PhotoDigitization} from './photo-digitization.ts';
import type {PhotoCoastData} from './photo-coast.ts';
export type UserShorelineGuides=PhotoDigitization&{reference_capture:number;reference_date:string};
/** A guide changes the dated reference only. It does not approve other dates. */
export function applyUserShorelineGuides(data:PhotoCoastData,review:UserShorelineGuides,dataSha:string):PhotoCoastData{
 if(data.captures[review.reference_capture]?.date!==review.reference_date||review.corrections.some(c=>c.capture!==review.reference_capture))throw new Error('Fecha de guía incompatible');
 const result=applyPhotoDigitization(data,review,dataSha),sources=new Map(review.corrections.map(c=>[c.profile_id,c.source]));
 return {...result,targets:result.targets.map(t=>sources.has(t.id)?{...t,fixed_reference:{capture:review.reference_capture,method:review.method,source:sources.get(t.id)!,verified_release:review.sources.find(s=>s.id===sources.get(t.id))!.release}}:t)};
}
