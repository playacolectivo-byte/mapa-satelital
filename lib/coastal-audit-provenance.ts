import type {PhotoCoastReading} from './photo-coast.ts';
import type {CoastalAuditReading} from './coastal-audit-reviews.ts';

/** Provenance belongs to this observation, not its municipality, a nearby
 * profile or a different edition. Rejected observations remain scoped. */
export function coastalAuditForReading(reading:PhotoCoastReading|undefined,release:number|null=null){
 const audit=(reading as CoastalAuditReading|undefined)?.coastal_audit;
 if(!reading||!audit?.review_id)return null;
 const source=release??audit.source_release;
 if(!reading.releases.includes(source))return null;
 if(!reading.accepted)return source===audit.source_release?audit:null;
 const metadata=source===audit.source_release?audit.metadata:audit.equivalent_metadata?.find(m=>m.release===source);
 if(reading.manual_review?.id!==audit.review_id||metadata?.positionOffset!==reading.offset_m||metadata.release!==source)return null;
 return source===audit.source_release?audit:{...audit,source_release:source,metadata};
}

export function coastalAuditFeatureProperties(endpoint:PhotoCoastReading|undefined,baseline:PhotoCoastReading|undefined,release:number|null=null){
 const end=coastalAuditForReading(endpoint,release),base=coastalAuditForReading(baseline);
 const record=(r:PhotoCoastReading,a:NonNullable<ReturnType<typeof coastalAuditForReading>>)=>({review_id:a.review_id,timestamp:a.timestamp,capture:r.capture,source_release:a.source_release,accepted:r.accepted});
 return {
  ...(end?{photo_endpoint_audit:record(endpoint!,end),photo_review_tile_zoom:17}:{}),
  ...(base?{photo_baseline_audit:record(baseline!,base)}:{}),
  ...(end||base?{photo_audit_preserve_control:true}:{}),
  ...(end?.method_url||base?.method_url?{photo_audit_method_url:end?.method_url??base?.method_url}:{})
 };
}
