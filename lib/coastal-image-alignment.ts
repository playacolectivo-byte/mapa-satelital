import type {CoastalAnalysisData} from './coastal-analysis.ts';
import type {CoastalScenario,ScenarioTarget} from './coastal-scenario.ts';
import {createScenarioLayerCache} from './coastal-result-view.ts';
import {photoCoastBaselineYear,photoCoastPosition,photoCoastCoordinate,photoCoastDistance,photoCoastUncertainty,photoCoastFixedReference,type PhotoCoastData,type PhotoCoastReading} from './photo-coast.ts';
import {datedImageReviews,datedReviewForMethod} from './dated-image-reviews.ts';
import type {PhotoSourceReview} from './photo-source-review.ts';
import {coastalAuditForReading,coastalAuditFeatureProperties} from './coastal-audit-provenance.ts';

type Coordinate=[number,number];
type Anchor={coordinate:Coordinate;kind:'photo'|'spatial_estimate'|'cartography';capture:number|null;sourceKey:string|null;offset:number|null;donors:string[]};
type Neighbour={i:number;along:number;distance:number;anchor:Anchor};
export type CoastalAlignmentSummary={audited:number;beachProfiles:number;structures:number;otherCoasts:number;photoPositions:number;spatialPositions:number;pendingPositions:number;photoComparisons:number;modelLocators:number};
export type CoastalAlignedFrame={layer:CoastalAnalysisData;summary:CoastalAlignmentSummary;release:number|null;year:number};

const at=(_model:CoastalScenario,t:ScenarioTarget,offset:number):Coordinate=>photoCoastCoordinate(t,offset);
const isStructure=(t:ScenarioTarget)=>t.type==='Rompeolas'||t.type==='Construcción portuaria';

/** Same-capture, bracketing neighbours can suggest a locator, never a new
 * local waterline measurement. No one-sided extrapolation or pier snapping. */
function interpolatedAnchor(model:CoastalScenario,t:ScenarioTarget,reading:PhotoCoastReading|undefined,sourceKey:string|null,direct:Map<number,Anchor>,indices:number[]):Anchor|null{
 if(!reading)return null;
 const tx=-t.v[1],ty=t.v[0];
 let left:Neighbour|null=null,right:Neighbour|null=null;
 for(const i of indices){
  const u=model.targets[i],anchor=direct.get(i);
  if(!anchor||anchor.sourceKey!==sourceKey||anchor.offset===null||u.v[0]*t.v[0]+u.v[1]*t.v[1]<.95)continue;
  const dx=(u.p[0]-t.p[0])*model.coordinate_scale[0],dy=(u.p[1]-t.p[1])*model.coordinate_scale[1],distance=Math.hypot(dx,dy),along=dx*tx+dy*ty;
  if(distance<20||distance>300||Math.abs(along)<20)continue;
  const item={i,along,distance,anchor};
  if(along<0&&(!left||distance<left.distance))left=item;
  if(along>0&&(!right||distance<right.distance))right=item;
 }
 if(!left||!right||left.distance+right.distance>500||Math.abs(left.anchor.offset!-right.anchor.offset!)>30)return null;
 const fraction=-left.along/(right.along-left.along);
 const offset=left.anchor.offset!+(right.anchor.offset!-left.anchor.offset!)*fraction;
 return {coordinate:at(model,t,offset),kind:'spatial_estimate',capture:reading.capture,sourceKey,offset,donors:[model.targets[left.i].id,model.targets[right.i].id]};
}

/** Every trajectory retains one fixed reference, independent of the camera,
 * displayed edition and selected year. Photo pairs remain apparent measured
 * differences; missing dates/references use explicitly estimated trajectories.
 * The original annual model is retained independently, never called a photo.
 *
 * The release must be the image actually displayed, not the requested image.
 * Per-point capture years can differ within that same Esri release. */
export function createCoastalImageAlignment(model:CoastalScenario,photos:PhotoCoastData,sourceReview?:PhotoSourceReview){
 if(photos.model_sha256.length!==64||photos.targets.length!==model.targets.length||photos.targets.some((r,i)=>r.id!==model.targets[i].id))throw new Error('Inventario de alineación incompatible');
 if(sourceReview&&(sourceReview.version!==1||sourceReview.algorithm!=='source-aware-photo-anchors-v1'||sourceReview.model_sha256!==photos.model_sha256))throw new Error('Revisión de fuentes incompatible');
 const isBeach=(i:number)=>model.targets[i].type.startsWith('Playa')||photos.targets[i].reviewed_beach_control===true;
 const reviewedReadings=new Map(photos.targets.map(row=>[row.id,row.readings]));
 const sourceBlocked=new Map(sourceReview?.blocked.filter(issue=>!reviewedReadings.get(issue.profile_id)?.some(r=>r.accepted&&!!datedReviewForMethod(r.manual_review?.id??'')&&r.releases.includes(issue.release))).map(r=>[r.release+':'+r.profile_id,r])??[]);

 const scenarios=createScenarioLayerCache(model);
 const frames=new Map<string,CoastalAlignedFrame>();
 const captureKeys=photos.captures.map(c=>c.date+'|'+c.source+'|'+c.resolution_m);
 const reviewedGeneralPosition=(r:PhotoCoastReading|undefined,release:number|null)=>!!r?.accepted&&release!==null&&r.releases.includes(release)&&(!!coastalAuditForReading(r,release)||!!datedReviewForMethod(r.manual_review?.id??''));
 const cumulative=(t:ScenarioTarget,year:number)=>model.years.reduce((n,y,j)=>n+(y>2010&&y<=year?t.d[j]:0),0);
 const verifiedEndpoint=(i:number,r:PhotoCoastReading|undefined,release:number|null)=>!!r&&(r.accepted&&!!coastalAuditForReading(r,release)||photos.targets[i].review_policy?.reviewed_captures?.some(v=>v.capture===r.capture&&v.releases.includes(release!))||photos.targets[i].fixed_reference?.capture===r.capture&&photos.targets[i].fixed_reference?.verified_release===release);
 const usable=photos.targets.map((row,i)=>row.readings.filter(r=>r.accepted&&r.releases.some(release=>!sourceBlocked.has(release+':'+row.id)||verifiedEndpoint(i,r,release))));
 // The audit also rejects profiles in every date. Those must remain pending,
 // rather than falling back to an illustrative trajectory after rejection.
 const appliedMethods=new Set(photos.targets.flatMap(row=>row.readings.flatMap(r=>r.manual_review?[r.manual_review.id]:[])));
 const scopedAudits=datedImageReviews.filter(r=>appliedMethods.has(r.method)).map(review=>({review,ids:review.profile_ids?new Set(review.profile_ids):null}));
 // A bounded context audit must not label the rest of a neighbouring
 // municipality as reviewed. Preserve every profile's original municipality.
 const targetReview=new Map(model.targets.flatMap(t=>{const match=scopedAudits.find(a=>a.ids?a.ids.has(t.id):a.review.municipality===t.m);return match?[[t.id,match.review] as const]:[];}));
 const reviewedDated=new Set(targetReview.keys());
 const references=model.targets.map((t,i)=>{
  if(reviewedDated.has(t.id)){
   const rows=[...usable[i]].sort((a,b)=>photos.captures[a.capture].date.localeCompare(photos.captures[b.capture].date));
   const first=rows[0];
   if(first){const capture=photos.captures[first.capture];return {year:Number(capture.date.slice(0,4)),offset:first.offset_m!,kind:'photo' as const,captures:[capture],error:photoCoastUncertainty(capture,first),date:capture.date};}
  }
  const missing=photos.targets[i].reference_unavailable;
  if(missing)return {year:missing.year,offset:0,kind:'unavailable' as const,captures:[],error:null,date:null};
  const fixed=photoCoastFixedReference(photos,photos.targets[i]);if(fixed)return {...fixed,kind:'photo' as const};
  const policy=photos.targets[i].review_policy;
  const reviewed=policy?usable[i].find(r=>r.capture===policy.reference_capture):null;
  if(policy&&reviewed){const c=photos.captures[reviewed.capture];return {year:Number(c.date.slice(0,4)),offset:reviewed.offset_m!,kind:'photo' as const,captures:[c],error:photoCoastUncertainty(c,reviewed),date:c.date};}
  const rows=usable[i],year=photoCoastBaselineYear(photos,rows,2010)??2011;
  const position=photoCoastPosition(photos,rows,year,null);
  if(position?.kind==='photo')return {...position,year,kind:'photo' as const};
  // A reconstructed reference is an estimate, not an invented observation.
  // Anchor to the earliest accepted photo; absent photos retain the received
  // nominal 2025 cartography and the original model, visibly under review.
  const first=[...rows].sort((a,b)=>photos.captures[a.capture].date.localeCompare(photos.captures[b.capture].date))[0];
  const capture=first?photos.captures[first.capture]:null,anchorYear=capture?Number(capture.date.slice(0,4)):2025;
  return {year,offset:(first?.offset_m??0)+cumulative(t,year)-cumulative(t,anchorYear),kind:'model' as const,captures:capture?[capture]:[],error:null,date:null};
 });
 const anchorCache=new Map<string,{anchors:Anchor[];readings:(PhotoCoastReading|undefined)[]}>();
 const municipalities=new Map<string,number[]>();
 model.targets.forEach((t,i)=>{if(isBeach(i)){const ids=municipalities.get(t.m)??[];ids.push(i);municipalities.set(t.m,ids);}});
 const anchorsFor=(release:number|null,tileZoom:number)=>{
  const key=release+':'+tileZoom;
  const cached=anchorCache.get(key);if(cached)return cached;
  const readings=photos.targets.map(row=>{
   if(release===null)return undefined;
   const reading=row.readings.find(r=>r.releases.includes(release));
   if(tileZoom<=17||!reading?.detail_offsets)return reading;
   const offset=tileZoom===18?reading.detail_offsets.find(([edition])=>edition===release)?.[1]:undefined;
   // Retain this edition's z17 observation when enlarged, explicitly pending
   // as an HD interpretation. A larger tile does not create a new offset.
   if(offset===undefined&&reviewedGeneralPosition(reading,release))return reading;
   return offset===undefined?undefined:{...reading,offset_m:offset};
  });
  const direct=new Map<number,Anchor>();
  readings.forEach((r,i)=>{if(r?.accepted&&isBeach(i)&&(!sourceBlocked.has(release+':'+model.targets[i].id)||verifiedEndpoint(i,r,release)))direct.set(i,{coordinate:at(model,model.targets[i],r.offset_m!),kind:'photo',capture:r.capture,sourceKey:captureKeys[r.capture],offset:r.offset_m,donors:[]});});
  const anchors=model.targets.map((t,i):Anchor=>direct.get(i)??(sourceBlocked.has(release+':'+t.id)?null:isBeach(i)?interpolatedAnchor(model,t,readings[i],readings[i]?captureKeys[readings[i]!.capture]:null,direct,municipalities.get(t.m)??[]):null)??{coordinate:t.p,kind:'cartography',capture:null,sourceKey:null,offset:null,donors:[]});
  const result={anchors,readings};anchorCache.set(key,result);
  while(anchorCache.size>3)anchorCache.delete(anchorCache.keys().next().value!);
  return result;
 };
 return {
 stationReferences(){
  return model.targets.flatMap((target, index) => {
   const reference = references[index];
   return isBeach(index) && reference.kind === 'photo'
    ? [{ coordinate: at(model, target, reference.offset), municipality: target.m }] : [];
  });
 },
 read(year:number,release:number|null,tileZoom=17):CoastalAlignedFrame{
  const level=Math.max(17,tileZoom);
  const key=year+':'+release+':'+level,cached=frames.get(key);
  if(cached){frames.delete(key);frames.set(key,cached);return cached;}
  const scenario=scenarios.read(year),{anchors,readings}=anchorsFor(release,level);
  const summary:CoastalAlignmentSummary={audited:model.targets.length,beachProfiles:0,structures:0,otherCoasts:0,photoPositions:0,spatialPositions:0,pendingPositions:0,photoComparisons:0,modelLocators:0};
  const features:CoastalAnalysisData['features']=[];
  model.targets.forEach((t,i)=>{
   if(!isBeach(i)){if(isStructure(t))summary.structures++;else summary.otherCoasts++;return;}
   summary.beachProfiles++;
   const anchor=anchors[i],reading=readings[i],capture=reading?photos.captures[reading.capture]:null;
   const fixed=photos.targets[i].fixed_reference;
   const sourceIssue=verifiedEndpoint(i,reading,release)?undefined:sourceBlocked.get(release+':'+t.id);
   const reference=references[i],baselineYear=reference.year,base=reference.kind==='photo'?reference:null;
   const baselineCoordinate=at(model,t,reference.offset);
   const row=photos.targets[i],baselineReading=base?row.readings.find(r=>r.accepted&&r.offset_m===base.offset&&base.captures.includes(photos.captures[r.capture])):row.reference_unavailable?row.readings.find(r=>coastalAuditForReading(r)?.review_id===row.reference_unavailable!.method):undefined;
   const endpointAudit=coastalAuditForReading(reading,release),auditProperties=coastalAuditFeatureProperties(reading,baselineReading,release);
   const original=scenario.features[i],common={...original.properties,scenario_original_delta_m:original.properties.scenario_delta_m,image_alignment:anchor.kind,image_alignment_release:release,image_alignment_date:sourceIssue?.actual?.[0]??capture?.date??null,image_alignment_donors:anchor.donors,image_source_review:sourceIssue?.reason??null,image_anchor_coordinate:anchor.coordinate,cartographic_anchor_coordinate:t.p,spacing_eligible:reference.kind==='photo',alignment_method_url:targetReview.get(t.id)?.method_url??'/data/shorelines/photo-alignment/position-method.md',baseline_coordinate:baselineCoordinate,baseline_fixed:reference.kind!=='unavailable',user_reference_method:fixed?.method??null,reference_method_url:fixed?.method_url??(fixed?'/data/shorelines/photo-alignment/user-guides-2011-method.md':photos.targets[i].reference_unavailable?.method_url??null)};
   Object.assign(common,auditProperties,reviewedGeneralPosition(reading,release)&&level>17&&!(level===18&&reading?.detail_offsets?.some(([edition])=>edition===release))?{photo_detail_review_pending:true,photo_review_tile_zoom:17}:{});
   const sameYear=!!capture&&Number(capture.date.slice(0,4))===year;
   const unavailableDated=reviewedDated.has(t.id)&&(!base||baselineYear>year||anchor.kind!=='photo'||!sameYear);
   if(unavailableDated&&!auditProperties.photo_audit_preserve_control)return;
   const policy=row.review_policy;
   const reviewedEndpoint=!policy||year>=policy.first_year&&year<=policy.last_year&&(policy.reviewed_captures?policy.reviewed_captures.some(r=>r.capture===reading?.capture&&r.releases.includes(release!)):policy.reviewed_releases.includes(release!)&&(reading?.manual_review?.id===policy.method||reading?.capture===row.fixed_reference?.capture));
   if(policy&&!reviewedEndpoint||row.reference_unavailable)summary.pendingPositions++;else if(anchor.kind==='photo')summary.photoPositions++;else if(anchor.kind==='spatial_estimate')summary.spatialPositions++;else summary.pendingPositions++;
   if(endpointAudit&&!reading?.accepted){
    features.push({type:'Feature',id:t.id,geometry:{type:'Point',coordinates:base?baselineCoordinate:t.p},properties:{...common,baseline_year:baselineYear,comparison_start_year:baselineYear,comparison_end_year:year,baseline_date:reference.date,baseline_fixed:!!base,delta_m:null,scenario_delta_m:null,estimated:false,scenario_unvalidated:false,photo_interpretation:false,photo_review_pending:true,photo_review_method:endpointAudit.review_id,photo_review_reason:endpointAudit.reason,direction_unresolved:true,context_review:true,reference_only:false}});
   }else if(row.reference_unavailable){
    features.push({type:'Feature',id:t.id,geometry:{type:'Point',coordinates:anchor.coordinate},properties:{...common,baseline_year:2011,comparison_start_year:2011,comparison_end_year:year,baseline_date:null,delta_m:null,scenario_delta_m:null,estimated:false,scenario_unvalidated:false,photo_interpretation:false,photo_review_pending:true,photo_review_method:row.reference_unavailable.method,photo_review_reason:row.reference_unavailable.reason,direction_unresolved:true,context_review:true,reference_only:false,method_url:row.reference_unavailable.method_url}});
   }else if(unavailableDated){
    // Keeping an audited control visible must not turn a missing date/source
    // into a modelled trajectory within an explicitly dated review scope.
    features.push({type:'Feature',id:t.id,geometry:{type:'Point',coordinates:base?baselineCoordinate:t.p},properties:{...common,baseline_year:baselineYear,comparison_start_year:baselineYear,comparison_end_year:year,baseline_date:reference.date,baseline_fixed:!!base,delta_m:null,scenario_delta_m:null,estimated:false,scenario_unvalidated:false,photo_interpretation:false,photo_review_pending:true,photo_review_method:endpointAudit?.review_id??coastalAuditForReading(baselineReading)?.review_id??targetReview.get(t.id)?.method,photo_review_reason:baselineYear>year?'before_reviewed_reference':!sameYear?'no_dated_photo_for_year':'edition_or_position_not_reviewed',direction_unresolved:true,context_review:true,reference_only:false}});
   }else
   if(policy&&(!reviewedEndpoint||anchor.kind!=='photo'||!reading||!sameYear||!base||baselineYear>year)){
    features.push({type:'Feature',id:t.id,geometry:{type:'Point',coordinates:baselineCoordinate},properties:{...common,baseline_year:baselineYear,comparison_start_year:baselineYear,comparison_end_year:year,baseline_date:reference.date,delta_m:null,scenario_delta_m:null,estimated:false,scenario_unvalidated:false,photo_interpretation:false,photo_review_pending:true,photo_review_method:policy.method,photo_review_reason:year<policy.first_year||year>policy.last_year?'outside_review_period':!sameYear?'no_dated_photo_for_year':'edition_or_position_not_reviewed',direction_unresolved:true,context_review:true,reference_only:false,method_url:policy.method_url??'/data/shorelines/photo-alignment/progreso-oeste-20261105-method.md'}});
   }else if(anchor.kind==='photo'&&reading&&sameYear&&base&&baselineYear<=year){
    // Offsets reproduce the source pixels; metres use the WGS84 coordinates.
    // Translating a picture or copying the model's delta cannot enter here.
    const isReference=reviewedDated.has(t.id)?base.date===capture.date:row.fixed_reference?reading.capture===row.fixed_reference.capture:policy?reading.capture===policy.reference_capture:baselineYear===year;
    const endOffset=isReference?base.offset:reading.offset_m!;
    const delta=Math.sign(endOffset-base.offset)*photoCoastDistance(baselineCoordinate,at(model,t,endOffset));
    const endError=photoCoastUncertainty(capture,reading);
    const error=base.error===null||endError===null?null:Math.hypot(base.error,endError);
    const photoSources=[...base.captures,capture];
    const metadataPoints=[...(fixed?[{release:fixed.verified_release,coordinate:baselineCoordinate,date:base.date}]:[]),{release:release!,coordinate:at(model,t,endOffset),date:capture.date}];
    summary.photoComparisons++;
    const usedCaptures=new Set(photoSources);
    const manual=usable[i].filter(r=>r.manual_review&&usedCaptures.has(photos.captures[r.capture])).map(r=>r.manual_review!);
    const referenceReleases=fixed?[fixed.verified_release]:row.readings.filter(r=>r.accepted&&base.captures.includes(photos.captures[r.capture])).flatMap(r=>r.releases.slice(0,1));
    features.push({type:'Feature',id:t.id,geometry:{type:'LineString',coordinates:[baselineCoordinate,at(model,t,endOffset)]},properties:{...common,baseline_year:baselineYear,baseline_requested_year:policy?.first_year??2010,comparison_start_year:baselineYear,comparison_end_year:year,photo_baseline_fallback:!policy&&baselineYear!==2010,reference_only:isReference,photo_interpretation:true,photo_location_matched:true,photo_mismatch:false,photo_date:capture.date,delta_m:delta,estimated:false,scenario_unvalidated:false,direction_unresolved:error===null||Math.abs(delta)<=error,context_review:false,photo_start_kind:'photo',photo_end_kind:'photo',date_before:base.date,date_after:capture.date,registration_proxy_m:error,photo_sources:photoSources,photo_metadata_points:metadataPoints,photo_manual_reviews:manual,photo_review_method:policy?.method??null,photo_source_releases:[...new Set([release!,...referenceReleases])],photo_anchor_coordinate:t.p,photo_rejection_reasons:[],method_url:targetReview.get(t.id)?.method_url??policy?.method_url??(policy?'/data/shorelines/photo-alignment/progreso-oeste-20261105-method.md':'/data/shorelines/photo-alignment/position-method.md')}});
   }else{
    summary.modelLocators++;
    const compatibleRows=sourceIssue?usable[i].filter(r=>!r.releases.includes(release!)):usable[i];
    const end=photoCoastPosition(photos,compatibleRows,year,release);
    const beforeReference=year<baselineYear;
    const offset=year===baselineYear?reference.offset:anchor.kind==='spatial_estimate'&&sameYear&&anchor.offset!==null?anchor.offset:end?.offset??reference.offset+cumulative(t,year)-cumulative(t,baselineYear);
    const delta=beforeReference?null:Math.sign(offset-reference.offset)*photoCoastDistance(baselineCoordinate,at(model,t,offset));
    features.push({type:'Feature',id:t.id,geometry:beforeReference?{type:'Point',coordinates:baselineCoordinate}:{type:'LineString',coordinates:[baselineCoordinate,at(model,t,offset)]},properties:{...common,delta_m:delta,scenario_delta_m:delta,baseline_year:baselineYear,comparison_start_year:baselineYear,comparison_end_year:year,baseline_date:reference.date,trajectory_estimate:true,trajectory_reference_kind:reference.kind,trajectory_end_kind:anchor.kind==='spatial_estimate'&&sameYear?'spatial_estimate':end?.kind??'model',trajectory_sources:[...reference.captures,...(end?.captures??[])],before_reference:beforeReference,estimated:true,scenario_unvalidated:true,scenario_locator_only:false,context_review:beforeReference||Boolean(sourceIssue)||!usable[i].length,reference_only:year<=baselineYear,photo_interpretation:false,method_url:'/data/shorelines/photo-alignment/fixed-reference-method.md'}});
   }
  });
  const result={layer:{type:'FeatureCollection' as const,features},summary,release,year};frames.set(key,result);
  while(frames.size>3)frames.delete(frames.keys().next().value!);
  return result;
 }};
}
