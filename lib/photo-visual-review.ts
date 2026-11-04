import type {PhotoCoastData} from './photo-coast.ts';
export type PhotoVisualReview={version:number;data_sha256:string;exclusions:{profile_id:string;capture:number;date:string;original_offset_m:number}[]};

/** Review exclusions only remove known bad candidates. They cannot introduce
 * an offset, move a point, or change the immutable received observation file. */
export function applyPhotoVisualReview(data:PhotoCoastData,review:PhotoVisualReview,dataSha:string):PhotoCoastData{
 if(review.version!==1||review.data_sha256!==dataSha)throw new Error('Revisión visual de otra versión de datos');
 const entries=new Map(review.exclusions.map(r=>[r.profile_id+':'+r.capture,r]));
 if(entries.size!==review.exclusions.length)throw new Error('Revisión visual duplicada');
 let found=0;
 const targets=data.targets.map(target=>{
  const readings=target.readings.map(reading=>{
   const entry=entries.get(target.id+':'+reading.capture);if(!entry)return reading;
   if(data.captures[reading.capture].date!==entry.date||reading.offset_m!==entry.original_offset_m)throw new Error('La lectura revisada cambió');
   found++;
   return {...reading,accepted:false,reasons:[...new Set([...reading.reasons,'manual_visual_discrepancy'])]};
  });
  return readings.every((reading,i)=>reading===target.readings[i])?target:{...target,readings};
 });
 if(found!==entries.size)throw new Error('Faltan lecturas de la revisión visual');
 return {...data,targets};
}
