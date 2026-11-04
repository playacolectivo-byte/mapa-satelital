import type {CoastalAnalysisData} from './coastal-analysis.ts';
import type {CoastalScenario,ScenarioTarget} from './coastal-scenario.ts';
import {createScenarioLayerCache} from './coastal-result-view.ts';
import {photoCoastBaselineYear,photoCoastPosition,photoCoastCoordinate,photoCoastUncertainty,type PhotoCoastData,type PhotoCoastReading} from './photo-coast.ts';
import type {PhotoSourceReview} from './photo-source-review.ts';

type Coordinate=[number,number];
type Anchor={coordinate:Coordinate;kind:'photo'|'spatial_estimate'|'cartography';capture:number|null;sourceKey:string|null;offset:number|null;donors:string[]};
type Neighbour={i:number;along:number;distance:number;anchor:Anchor};
export type CoastalAlignmentSummary={audited:number;beachProfiles:number;structures:number;otherCoasts:number;photoPositions:number;spatialPositions:number;pendingPositions:number;photoComparisons:number;modelLocators:number};
export type CoastalAlignedFrame={layer:CoastalAnalysisData;summary:CoastalAlignmentSummary;release:number|null;year:number};

const at=(_model:CoastalScenario,t:ScenarioTarget,offset:number):Coordinate=>photoCoastCoordinate(t,offset);
const isBeach=(t:ScenarioTarget)=>t.type.startsWith('Playa');
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
 const sourceBlocked=new Map(sourceReview?.blocked.map(r=>[r.release+':'+r.profile_id,r])??[]);
 const scenarios=createScenarioLayerCache(model);
 const frames=new Map<string,CoastalAlignedFrame>();
 const captureKeys=photos.captures.map(c=>c.date+'|'+c.source+'|'+c.resolution_m);
 const cumulative=(t:ScenarioTarget,year:number)=>model.years.reduce((n,y,j)=>n+(y>2010&&y<=year?t.d[j]:0),0);
 const usable=photos.targets.map(row=>row.readings.filter(r=>r.accepted&&r.releases.some(release=>!sourceBlocked.has(release+':'+row.id))));
 const references=model.targets.map((t,i)=>{
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
 const anchorCache=new Map<number|null,{anchors:Anchor[];readings:(PhotoCoastReading|undefined)[]}>();
 const municipalities=new Map<string,number[]>();
 model.targets.forEach((t,i)=>{if(isBeach(t)){const ids=municipalities.get(t.m)??[];ids.push(i);municipalities.set(t.m,ids);}});
 const anchorsFor=(release:number|null)=>{
  const cached=anchorCache.get(release);if(cached)return cached;
  const readings=photos.targets.map(row=>release===null?undefined:row.readings.find(r=>r.releases.includes(release)));
  const direct=new Map<number,Anchor>();
  readings.forEach((r,i)=>{if(r?.accepted&&isBeach(model.targets[i])&&!sourceBlocked.has(release+':'+model.targets[i].id))direct.set(i,{coordinate:at(model,model.targets[i],r.offset_m!),kind:'photo',capture:r.capture,sourceKey:captureKeys[r.capture],offset:r.offset_m,donors:[]});});
  const anchors=model.targets.map((t,i):Anchor=>sourceBlocked.has(release+':'+t.id)?{coordinate:t.p,kind:'cartography',capture:null,sourceKey:null,offset:null,donors:[]}:direct.get(i)??(isBeach(t)?interpolatedAnchor(model,t,readings[i],readings[i]?captureKeys[readings[i]!.capture]:null,direct,municipalities.get(t.m)??[]):null)??{coordinate:t.p,kind:'cartography',capture:null,sourceKey:null,offset:null,donors:[]});
  const result={anchors,readings};anchorCache.set(release,result);
  while(anchorCache.size>3)anchorCache.delete(anchorCache.keys().next().value!);
  return result;
 };
 return {read(year:number,release:number|null):CoastalAlignedFrame{
  const key=year+':'+release,cached=frames.get(key);
  if(cached){frames.delete(key);frames.set(key,cached);return cached;}
  const scenario=scenarios.read(year),{anchors,readings}=anchorsFor(release);
  const summary:CoastalAlignmentSummary={audited:model.targets.length,beachProfiles:0,structures:0,otherCoasts:0,photoPositions:0,spatialPositions:0,pendingPositions:0,photoComparisons:0,modelLocators:0};
  const features:CoastalAnalysisData['features']=[];
  model.targets.forEach((t,i)=>{
   if(!isBeach(t)){if(isStructure(t))summary.structures++;else summary.otherCoasts++;return;}
   summary.beachProfiles++;
   const anchor=anchors[i],reading=readings[i],capture=reading?photos.captures[reading.capture]:null;
   if(anchor.kind==='photo')summary.photoPositions++;else if(anchor.kind==='spatial_estimate')summary.spatialPositions++;else summary.pendingPositions++;
   const sourceIssue=sourceBlocked.get(release+':'+t.id);
   const reference=references[i],baselineYear=reference.year,base=reference.kind==='photo'?reference:null;
   const baselineCoordinate=at(model,t,reference.offset);
   const original=scenario.features[i],common={...original.properties,scenario_original_delta_m:original.properties.scenario_delta_m,image_alignment:anchor.kind,image_alignment_release:release,image_alignment_date:sourceIssue?.actual?.[0]??capture?.date??null,image_alignment_donors:anchor.donors,image_source_review:sourceIssue?.reason??null,image_anchor_coordinate:anchor.coordinate,cartographic_anchor_coordinate:t.p,spacing_eligible:reference.kind==='photo',alignment_method_url:'/data/shorelines/photo-alignment/position-method.md',baseline_coordinate:baselineCoordinate,baseline_fixed:true};
   const row=photos.targets[i];
   const sameYear=!!capture&&Number(capture.date.slice(0,4))===year;
   if(anchor.kind==='photo'&&reading&&sameYear&&base&&baselineYear<=year){
    // All metres are recomputed from the two real offsets on the same axis.
    // Translating a picture or copying the model's delta cannot enter here.
    const endOffset=baselineYear===year?base.offset:reading.offset_m!;
    const delta=endOffset-base.offset;
    const endError=photoCoastUncertainty(capture,reading);
    const error=base.error===null||endError===null?null:Math.hypot(base.error,endError);
    const photoSources=[...base.captures,capture];
    summary.photoComparisons++;
    const manual=usable[i].filter(r=>r.manual_review&&photoSources.some(c=>c.date===photos.captures[r.capture].date)).map(r=>r.manual_review!);
    features.push({type:'Feature',id:t.id,geometry:{type:'LineString',coordinates:[baselineCoordinate,at(model,t,endOffset)]},properties:{...common,baseline_year:baselineYear,baseline_requested_year:2010,comparison_start_year:baselineYear,comparison_end_year:year,photo_baseline_fallback:baselineYear!==2010,reference_only:baselineYear===year,photo_interpretation:true,photo_location_matched:true,photo_mismatch:false,photo_date:capture.date,delta_m:delta,estimated:false,scenario_unvalidated:false,direction_unresolved:error===null||Math.abs(delta)<=error,context_review:false,photo_start_kind:'photo',photo_end_kind:'photo',date_before:base.date,date_after:capture.date,registration_proxy_m:error,photo_sources:photoSources,photo_manual_reviews:manual,photo_source_releases:[...new Set([release!,...row.readings.filter(r=>r.accepted&&base.captures.some(c=>c.date===photos.captures[r.capture].date)).flatMap(r=>r.releases.slice(0,1))])],photo_anchor_coordinate:t.p,photo_rejection_reasons:[],method_url:'/data/shorelines/photo-alignment/position-method.md'}});
   }else{
    summary.modelLocators++;
    const compatibleRows=sourceIssue?usable[i].filter(r=>!r.releases.includes(release!)):usable[i];
    const end=photoCoastPosition(photos,compatibleRows,year,release);
    const beforeReference=year<baselineYear;
    const offset=year===baselineYear?reference.offset:anchor.kind==='spatial_estimate'&&sameYear&&anchor.offset!==null?anchor.offset:end?.offset??reference.offset+cumulative(t,year)-cumulative(t,baselineYear);
    const delta=beforeReference?null:offset-reference.offset;
    features.push({type:'Feature',id:t.id,geometry:beforeReference?{type:'Point',coordinates:baselineCoordinate}:{type:'LineString',coordinates:[baselineCoordinate,at(model,t,offset)]},properties:{...common,delta_m:delta,scenario_delta_m:delta,baseline_year:baselineYear,comparison_start_year:baselineYear,comparison_end_year:year,baseline_date:reference.date,trajectory_estimate:true,trajectory_reference_kind:reference.kind,trajectory_end_kind:anchor.kind==='spatial_estimate'&&sameYear?'spatial_estimate':end?.kind??'model',trajectory_sources:[...reference.captures,...(end?.captures??[])],before_reference:beforeReference,estimated:true,scenario_unvalidated:true,scenario_locator_only:false,context_review:beforeReference||Boolean(sourceIssue)||!usable[i].length,reference_only:year<=baselineYear,photo_interpretation:false,method_url:'/data/shorelines/photo-alignment/fixed-reference-method.md'}});
   }
  });
  const result={layer:{type:'FeatureCollection' as const,features},summary,release,year};frames.set(key,result);
  while(frames.size>3)frames.delete(frames.keys().next().value!);
  return result;
 }};
}
