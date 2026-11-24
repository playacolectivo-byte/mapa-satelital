import type {PhotoCoastData} from './photo-coast.ts';

export type DatedImageReview={version:1;method:string;field_validated:false;data_sha256:string;model_sha256:string;municipality:string;decisions:{profile_id:string;capture:number;date:string;releases:number[];verified_releases?:number[];original_offset_m:number|null;original_accepted:boolean;offset_m:number|null;detail_offsets?:[release:number,offset:number][];accepted:boolean;uncertainty_m:number;reason:string;source:{release:number;sheet:string;sheet_sha256:string;tile_sha256:string|null;metadata_checks:{date:string|null}[];edition_checks?:{release:number;dates:(string|null)[]}[];detail_checks?:{release:number;dates:(string|null)[];tile_sha256:string}[]}}[]};

/** Versioned image interpretations. The received observations remain intact.
 * Accept and reject decisions both apply; missing interpretations are not zero. */
export function applyDatedImageReview(data:PhotoCoastData,review:DatedImageReview,originalSha:string,expected:{municipality:string;method:string;rejection_reason:string}):PhotoCoastData{
 if(review.version!==1||review.field_validated!==false||(review.municipality!==expected.municipality||review.method!==expected.method)||review.data_sha256!==originalSha||review.model_sha256!==data.model_sha256)throw new Error('Revisión de imágenes de otra versión');
 const changes=new Map(review.decisions.map(d=>[d.profile_id+':'+d.capture,d]));
 if(changes.size!==review.decisions.length)throw new Error('Lectura de imágenes duplicada');
 let count=0;
 const targets=data.targets.map(t=>({...t,readings:t.readings.map(r=>{
  const d=changes.get(t.id+':'+r.capture);if(!d)return r;
  if(data.captures[r.capture].date!==d.date||r.offset_m!==d.original_offset_m||r.accepted!==d.original_accepted||!r.releases.includes(d.source.release)||d.releases.some(x=>!r.releases.includes(x))||!d.source.sheet_sha256.match(/^[a-f0-9]{64}$/)||d.accepted&&(!Number.isFinite(d.offset_m)||Math.abs(d.offset_m!)>=195||!d.source.tile_sha256?.match(/^[a-f0-9]{64}$/)||d.source.metadata_checks.length!==3||d.source.metadata_checks.some(s=>s.date!==d.date))||!(d.uncertainty_m>0))throw new Error('No coincide el punto o la fecha de la revisión');
  count++;
  const next={...r,offset_m:d.offset_m,accepted:d.accepted,reasons:d.accepted?[]:[expected.rejection_reason]};
  if(d.accepted){
   if(!d.verified_releases?.length||d.verified_releases.some(release=>!r.releases.includes(release)||!d.source.edition_checks?.some(c=>c.release===release&&c.dates.length===3&&c.dates.every(date=>date===d.date))))throw new Error('Edición sin fecha compatible');
   next.releases=d.verified_releases;
   if(d.detail_offsets!==undefined){
    const details=d.detail_offsets;
    if(new Set(details.map(([release])=>release)).size!==details.length||details.some(([release,offset])=>!next.releases.includes(release)||!Number.isFinite(offset)||Math.abs(offset)>=195||!d.source.detail_checks?.some(c=>c.release===release&&c.dates.length===3&&c.dates.every(date=>date===d.date)&&/^[a-f0-9]{64}$/.test(c.tile_sha256))))throw new Error('Edición de detalle sin fecha compatible');
    next.detail_offsets=details;
   }
  }
  if(d.accepted)next.manual_review={id:review.method,source:d.profile_id+':'+d.capture,uncertainty_m:d.uncertainty_m};else{delete next.manual_review;delete next.detail_offsets;}
  return next;
 })}));
 if(count!==changes.size)throw new Error('Inventario incompleto de la revisión');
 return {...data,targets};
}
