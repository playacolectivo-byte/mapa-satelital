import type {CoastalScenario,ScenarioTarget} from './coastal-scenario.ts';
import type {CoastalAnalysisData} from './coastal-analysis.ts';

export type PhotoCoastCapture={date:string;provider:string;source:string;resolution_m:number;accuracy_m:number|null};
export type PhotoCoastReading={capture:number;offset_m:number|null;spread_m:number|null;releases:number[];accepted:boolean;reasons:string[];manual_review?:{id:string;source:string;uncertainty_m:number}};
export type PhotoReviewPolicy={method:string;reference_capture:number;first_year:number;last_year:number;reviewed_releases:number[];reviewed_captures?:{capture:number;releases:number[]}[];method_url?:string};
export type PhotoCoastTarget={id:string;readings:PhotoCoastReading[];review_policy?:PhotoReviewPolicy;fixed_reference?:{capture:number;method:string;source:string;verified_release:number;method_url?:string};reference_unavailable?:{year:number;reason:string;method:string;method_url:string}};
export type PhotoCoastData={version:1;method:string;field_validated:false;model_sha256:string;captures:PhotoCoastCapture[];targets:PhotoCoastTarget[]};
export function validatePhotoCoast(value:unknown):PhotoCoastData{
 const data=value as PhotoCoastData;
 if(data?.version!==1||data.field_validated!==false||!Array.isArray(data.captures)||!Array.isArray(data.targets)||!data.targets.length)throw new Error('Revisión de fotos incompatible');
 const ids=new Set<string>();
 for(const c of data.captures)if(!/^20\d\d-\d\d-\d\d$/.test(c.date)||!Number.isFinite(Date.parse(c.date))||!Number.isFinite(c.resolution_m)||c.resolution_m<=0||c.resolution_m>1||c.accuracy_m!==null&&(!Number.isFinite(c.accuracy_m)||c.accuracy_m<0))throw new Error('Fecha o calidad de foto inválida');
 for(const t of data.targets){
  if(ids.has(t.id)||!Array.isArray(t.readings))throw new Error('Perfil de foto inválido');ids.add(t.id);
  const policy=t.review_policy;
  if(policy&&(!policy.method||!t.reference_unavailable&&!data.captures[policy.reference_capture]||!Number.isInteger(policy.first_year)||!Number.isInteger(policy.last_year)||policy.last_year<policy.first_year||!Array.isArray(policy.reviewed_releases)||!policy.reviewed_captures&&!policy.reviewed_releases.length||policy.reviewed_releases.some(r=>!Number.isInteger(r))||policy.reviewed_captures?.some(r=>!data.captures[r.capture]||!r.releases.length||r.releases.some(v=>!Number.isInteger(v)))))throw new Error('Política de revisión fotográfica inválida');
  if(t.reference_unavailable&&(t.fixed_reference||t.reference_unavailable.year!==2011||!t.reference_unavailable.reason||!t.reference_unavailable.method))throw new Error('Referencia no disponible incompatible');
  for(const r of t.readings){
   const manual=r.manual_review;
   if(manual&&(!manual.id||!manual.source||!Number.isFinite(manual.uncertainty_m)||manual.uncertainty_m<=0))throw new Error('Trazado manual inválido');
   if(!data.captures[r.capture]||!Array.isArray(r.releases)||r.releases.some(v=>!Number.isInteger(v))||!Array.isArray(r.reasons)||r.accepted&&(typeof r.offset_m!=='number'||!Number.isFinite(r.offset_m)||Math.abs(r.offset_m)>=195||!manual&&(r.spread_m===null||!Number.isFinite(r.spread_m)||r.spread_m>16)||r.reasons.length))throw new Error('Cruce de foto inválido');
  }
  if(t.fixed_reference){const f=t.fixed_reference,r=t.readings.find(r=>r.capture===f.capture);if(!r?.accepted||r.manual_review?.id!==f.method||r.manual_review.source!==f.source||!r.releases.includes(f.verified_release))throw new Error('Referencia fija sin trazo compatible');}
 }
 return data;
}

type Position={offset:number;kind:'photo'|'interpolated'|'extrapolated';captures:PhotoCoastCapture[];captureIndices:number[];error:number|null;date:string|null};
const decimalDate=(date:string)=>{const y=Number(date.slice(0,4));return y+(Date.parse(date)-Date.UTC(y,0,1))/(Date.UTC(y+1,0,1)-Date.UTC(y,0,1));};
export function photoCoastUncertainty(c:PhotoCoastCapture,reading:PhotoCoastReading):number|null{return c.accuracy_m===null?null:Math.hypot(c.accuracy_m,3,reading.manual_review?.uncertainty_m??reading.spread_m??0);}
export function photoCoastFixedReference(data:PhotoCoastData,row:PhotoCoastTarget):(Position&{year:number})|null{
 const fixed=row.fixed_reference;if(!fixed)return null;
 const reading=row.readings.find(r=>r.capture===fixed.capture&&r.accepted&&r.manual_review?.id===fixed.method);if(!reading)throw new Error('Referencia fija no disponible');
 const capture=data.captures[reading.capture];return {year:Number(capture.date.slice(0,4)),offset:reading.offset_m!,kind:'photo',captures:[capture],captureIndices:[reading.capture],error:photoCoastUncertainty(capture,reading),date:capture.date};
}

/** Exact dated photographs are honoured. Annual gaps are explicit linear
 * estimates, not reused photographs. No donor profile or previous scenario
 * distance contributes to these positions or the resulting metres. */
export function photoCoastPosition(data:PhotoCoastData,readings:PhotoCoastReading[],year:number,release:number|null):Position|null{
 const accepted=readings.filter(r=>r.accepted).sort((a,b)=>data.captures[a.capture].date.localeCompare(data.captures[b.capture].date));
 if(!accepted.length)return null;
 const exact=accepted.filter(r=>Number(data.captures[r.capture].date.slice(0,4))===year);
 const chosen=exact.find(r=>release!==null&&r.releases.includes(release))??exact.at(-1);
 if(chosen){const c=data.captures[chosen.capture];return {offset:chosen.offset_m!,kind:'photo',captures:[c],captureIndices:[chosen.capture],error:photoCoastUncertainty(c,chosen),date:c.date};}
 // Use a fixed mid-year instant in years without a photograph. A one-year
 // extrapolation limit prevents ancient baselines built from distant images.
 const when=year+.5;
 const lo=accepted.filter(r=>decimalDate(data.captures[r.capture].date)<when).at(-1);
 const hi=accepted.find(r=>decimalDate(data.captures[r.capture].date)>when);
 let a=lo,b=hi,kind:Position['kind']='interpolated';
 if(!a||!b){
  kind='extrapolated';
  if(!lo){a=accepted[0];b=accepted.find(r=>decimalDate(data.captures[r.capture].date)-decimalDate(data.captures[a!.capture].date)>=2);}
  else{b=accepted.at(-1);a=[...accepted].reverse().find(r=>decimalDate(data.captures[b!.capture].date)-decimalDate(data.captures[r.capture].date)>=2);}
  const edge=!lo?accepted[0]:accepted.at(-1)!;
  if(Math.abs(year-Number(data.captures[edge.capture].date.slice(0,4)))>1)return null;
 }
 if(!a||!b||a===b)return null;
 const ca=data.captures[a.capture],cb=data.captures[b.capture],ta=decimalDate(ca.date),tb=decimalDate(cb.date);
 if(tb-ta<.25)return null;
 const fraction=(when-ta)/(tb-ta),offset=a.offset_m!+(b.offset_m!-a.offset_m!)*fraction;
 if(!Number.isFinite(offset)||Math.abs(offset)>250)return null;
 // This is a positional/georeferencing proxy only. Tide, wave and temporal
 // model errors are not known, so no total physical error is advertised.
 const ea=photoCoastUncertainty(ca,a),eb=photoCoastUncertainty(cb,b);
 return {offset,kind,captures:[ca,cb],captureIndices:[a.capture,b.capture],error:ea===null||eb===null?null:Math.hypot((1-fraction)*ea,fraction*eb),date:null};
}

/** Reproduce the actual Web-Mercator pixel sampling (local cosine scale),
 * rather than applying the scenario's single coast-wide degree conversion. */
export function photoCoastCoordinate(t:ScenarioTarget,d:number):[number,number]{
 const radius=6378137,lat=t.p[1]*Math.PI/180,scale=Math.cos(lat);
 const x=radius*t.p[0]*Math.PI/180+t.v[0]*d/scale;
 const y=radius*Math.asinh(Math.tan(lat))+t.v[1]*d/scale;
 return [x/radius*180/Math.PI,Math.atan(Math.sinh(y/radius))*180/Math.PI];
}
const position=(_model:CoastalScenario,t:ScenarioTarget,d:number):[number,number]=>photoCoastCoordinate(t,d);

/** A baseline must be read in an accepted photograph. If 2010 has no usable
 * position, use 2011 explicitly; never reconstruct 2010 from later photos. */
export function photoCoastBaselineYear(data:PhotoCoastData,readings:PhotoCoastReading[],preferredYear=2010):number|null{
 return (preferredYear===2010?[2010,2011]:[preferredYear]).find(year=>readings.some(r=>r.accepted&&Number(data.captures[r.capture].date.slice(0,4))===year))??null;
}

export function photoCoastComparison(model:CoastalScenario,data:PhotoCoastData,before:number,year:number,release:number|null,municipality:string|null=null):CoastalAnalysisData{
 if(data.targets.length!==model.targets.length||data.targets.some((t,i)=>t.id!==model.targets[i].id))throw new Error('Inventario de puntos incompatible');
 // The map requests one municipality. Skip the other regions before sorting
 // captures and allocating geometries; unscoped research exports stay full.
 return {type:'FeatureCollection',features:model.targets.flatMap((t,i)=>{
  if(municipality!==null&&t.m!==municipality)return [];
  const row=data.targets[i],fixed=photoCoastFixedReference(data,row),baselineYear=row.reference_unavailable?null:fixed?.year??photoCoastBaselineYear(data,row.readings,before);
  const reviewed=row.review_policy?.reviewed_captures;
  const readings=reviewed?row.readings.map(r=>({...r,accepted:r.accepted&&reviewed.some(v=>v.capture===r.capture&&(release===null||v.releases.includes(release)||Number(data.captures[r.capture].date.slice(0,4))!==year))})):row.readings;
  const candidate=baselineYear!==null&&year<baselineYear?null:fixed&&year===fixed.year&&release===null?fixed:photoCoastPosition(data,readings,year,release);
  const b=reviewed&&candidate?.kind!=='photo'?null:candidate;
  const a=fixed??(baselineYear===null?null:baselineYear===year?b:photoCoastPosition(data,readings,baselineYear,null));
  const imageReading=release===null?null:readings.find(r=>r.releases.includes(release));
  const imageCapture=imageReading?data.captures[imageReading.capture]:null;
  const photoMismatch=!!imageCapture&&Number(imageCapture.date.slice(0,4))!==year;
  const delta=a&&b?b.offset-a.offset:null;
  const error=a?.error!==null&&a?.error!==undefined&&b?.error!==null&&b?.error!==undefined?Math.hypot(a.error,b.error):null;
  // A rejected photo is never replaced with a colourful simulated line. Keep
  // every audited ID as a neutral reference; no number means unknown, not 0.
  const matched=imageReading?.accepted===true&&(!reviewed||reviewed.some(v=>v.capture===imageReading.capture&&v.releases.includes(release!)));
  const locator=matched?position(model,t,imageReading.offset_m!):release===null&&b?position(model,t,b.offset):t.p;
  const showBar=!!a&&!!b&&!photoMismatch&&(release===null||matched);
  const estimated=a?.kind!=='photo'||b?.kind!=='photo';
  const photoSources=[...(a?.captures??[]),...(b?.captures??[]),...(imageCapture?[imageCapture]:[])];
  const usedCaptures=new Set([...(a?.captureIndices??[]),...(b?.captureIndices??[]),...(imageReading?[imageReading.capture]:[])]);
  const sourceReleases=[...new Set([...(imageReading&&release!==null?[release]:[]),...row.readings.filter(r=>r.accepted&&usedCaptures.has(r.capture)).flatMap(r=>r.releases.slice(0,1))])];
  const manual=readings.filter(r=>r.accepted&&r.manual_review&&usedCaptures.has(r.capture)).map(r=>r.manual_review!);
  const endReading=b?.kind==='photo'?readings.find(r=>r.accepted&&r.capture===b.captureIndices[0]):null;
  const endRelease=endReading?(release!==null&&endReading.releases.includes(release)?release:reviewed?.find(r=>r.capture===endReading.capture)?.releases[0]??endReading.releases[0]):null;
  const metadataPoints=[...(fixed&&row.fixed_reference?[{release:row.fixed_reference.verified_release,coordinate:position(model,t,fixed.offset),date:fixed.date}]:[]),...(endReading&&endRelease!==null?[{release:endRelease,coordinate:position(model,t,endReading.offset_m!),date:data.captures[endReading.capture].date}]:[])];
  const reviewState=reviewed?{baseline_fixed:!!fixed,baseline_date:a?.date??null,photo_review_pending:!showBar,photo_review_reason:row.reference_unavailable?.reason??(!b?'no_dated_photo_for_year':!matched&&release!==null?'edition_or_position_not_reviewed':null)}:{};
  return {type:'Feature' as const,id:t.id,geometry:{type:'LineString' as const,coordinates:showBar?[position(model,t,a!.offset),position(model,t,b!.offset)]:[locator,locator]},properties:{...reviewState,profile_id:t.id,municipality:t.m,coast_type:t.type,municipality_is_approximate:t.municipality_approximate,year,baseline_year:baselineYear,baseline_requested_year:before,photo_baseline_fallback:baselineYear!==null&&baselineYear!==before,comparison_start_year:baselineYear,comparison_end_year:year,reference_only:fixed?b?.date===fixed.date:baselineYear===year,photo_interpretation:reviewed?showBar:true,photo_location_matched:matched,photo_verified_endpoint_releases:matched&&reviewed?reviewed.filter(v=>v.capture===imageReading?.capture).flatMap(v=>v.releases):[],photo_mismatch:photoMismatch,photo_date:imageCapture?.date??null,delta_m:showBar?delta:null,estimated:reviewed?false:estimated,scenario_unvalidated:false,direction_unresolved:!showBar||error===null||delta===null||Math.abs(delta)<=error,context_review:!showBar,photo_start_kind:a?.kind??null,photo_end_kind:b?.kind??null,date_before:a?.date??null,date_after:b?.date??null,registration_proxy_m:error,photo_sources:photoSources,photo_manual_reviews:manual,photo_metadata_points:metadataPoints,photo_review_method:row.review_policy?.method??null,photo_source_releases:sourceReleases,photo_anchor_coordinate:t.p,photo_rejection_reasons:imageReading?.reasons??(release===null?[]:['edition_not_reviewed']),user_reference_method:row.fixed_reference?.method??null,reference_method_url:row.fixed_reference?.method_url??(fixed?'/data/shorelines/photo-alignment/user-guides-2011-method.md':null),method_url:row.review_policy?.method_url??(data.method.startsWith('visible-beach-consensus')?'/data/shorelines/photo-alignment/position-method.md':'/data/shorelines/photo-alignment/method.md')}};
 })};
}

/** Only compatible photographed endpoints are interactive in the current
 * study. Rejected/mismatched references stay in the research data, rather
 * than appearing as erosion results for the requested year. */
export function compatiblePhotoCoastLayer(layer:CoastalAnalysisData,municipality:string|null):CoastalAnalysisData{
 return {type:'FeatureCollection',features:layer.features.filter(f=>
  (!municipality||f.properties.municipality===municipality)&&
  typeof f.properties.delta_m==='number'&&
  f.properties.photo_start_kind==='photo'&&f.properties.photo_end_kind==='photo'&&
  f.properties.photo_mismatch!==true&&f.properties.context_review!==true
 )};
}

export type PhotoCoastPresentation={scope:string;year:number;frameKey:string;layer:CoastalAnalysisData};
/** Publish imagery and its result layer together. While another year loads,
 * retain only the results that actually belong to the still-visible image. */
export function displayedPhotoCoastPresentation(scope:string,visibleFrameKey:string|null,candidate:PhotoCoastPresentation|null,previous:PhotoCoastPresentation|null):PhotoCoastPresentation|null{
 if(candidate?.scope===scope&&candidate.frameKey===visibleFrameKey)return candidate;
 if(previous?.scope===scope&&previous.frameKey===visibleFrameKey)return previous;
 return null;
}
