import type {PhotoCoastData} from './photo-coast.ts';

export type PhotoDigitization={
 version:number;data_sha256:string;model_sha256:string;method:string;field_validated:false;
 sources:{id:string;release:number;capture_date:string;screenshot_sha256:string}[];
 corrections:{profile_id:string;capture:number;date:string;releases:number[];original_offset_m:number|null;original_accepted:boolean;offset_m:number;manual_uncertainty_m:number;source:string}[];
};

/** A separately documented manual reading supersedes a rejected candidate.
 * It never changes the received dataset or pretends to be the RGB detector.
 * Fingerprints, dates, old values and source views must all match. */
export function applyPhotoDigitization(data:PhotoCoastData,review:PhotoDigitization,dataSha:string):PhotoCoastData{
 if(review.version!==1||review.field_validated!==false||review.data_sha256!==dataSha||review.model_sha256!==data.model_sha256)throw new Error('Trazado de otra versión de datos');
 const sources=new Map(review.sources.map(s=>[s.id,s]));
 const changes=new Map(review.corrections.map(c=>[c.profile_id+':'+c.capture,c]));
 if(changes.size!==review.corrections.length)throw new Error('Trazado manual duplicado');
 let found=0;
 const targets=data.targets.map(t=>({...t,readings:t.readings.map(r=>{
  const c=changes.get(t.id+':'+r.capture);if(!c)return r;
  const source=sources.get(c.source);
  if(!source||!source.screenshot_sha256.match(/^[a-f0-9]{64}$/)||source.capture_date!==c.date||!r.releases.includes(source.release)||data.captures[r.capture].date!==c.date||r.offset_m!==c.original_offset_m||r.accepted!==c.original_accepted||!Number.isFinite(c.offset_m)||Math.abs(c.offset_m)>=195||!Number.isFinite(c.manual_uncertainty_m)||c.manual_uncertainty_m<=0||c.releases.some(x=>!r.releases.includes(x)))throw new Error('No coincide la lectura trazada');
  found++;
  return {...r,offset_m:c.offset_m,accepted:true,reasons:[],manual_review:{id:review.method,source:c.source,uncertainty_m:c.manual_uncertainty_m}};
 })}));
 if(found!==changes.size)throw new Error('Faltan perfiles trazados');
 return {...data,targets};
}
