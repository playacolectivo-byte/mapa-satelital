import type {WaybackMetadata} from '@esri/wayback-core';
type RecordValue = {key:string;at:number;value:WaybackMetadata|null};
type Store = Pick<Storage,'getItem'|'setItem'>;
const slot='coastal-esri-exact-point-v1';
const maximum=192, maximumBytes=120000;
const valid=(value:unknown):value is WaybackMetadata|null=>value===null || !!value && typeof value==='object' && Number.isFinite((value as WaybackMetadata).date) && typeof (value as WaybackMetadata).provider==='string' && typeof (value as WaybackMetadata).source==='string';
/** Exact point + edition + scale only. No dates are propagated to neighbours.
 * A bounded metadata cache survives reload; imagery is never stored here. */
export class PointMetadataStore {
 private entries:RecordValue[]=[];
 private storage?:Store;
 private now:()=>number;
 constructor(storage?:Store,now=()=>Date.now()){
  this.storage=storage;this.now=now;
  try{const raw=storage?.getItem(slot);if(raw && raw.length<=maximumBytes){const data=JSON.parse(raw);if(Array.isArray(data))this.entries=data.slice(-maximum).filter(r=>typeof r.key==='string'&&r.key.length<800&&Number.isFinite(r.at)&&valid(r.value));}}catch{/* Storage can be unavailable in private browsing. */}
 }
 read(key:string):{value:WaybackMetadata|null}|undefined{
  const record=this.entries.find(r=>r.key===key);if(!record)return;
  const age=this.now()-record.at,ttl=record.value===null?60000:86400000;
  return age>=0&&age<ttl?{value:record.value}:undefined;
 }
 write(key:string,value:WaybackMetadata|null){
  if(!valid(value)||key.length>=800)return;
  this.entries=this.entries.filter(r=>r.key!==key);this.entries.push({key,at:this.now(),value});this.entries=this.entries.slice(-maximum);
  try{let raw=JSON.stringify(this.entries);while(raw.length>maximumBytes){this.entries.shift();raw=JSON.stringify(this.entries);}this.storage?.setItem(slot,raw);}catch{/* Quota denial never breaks imagery. */}
 }
}
