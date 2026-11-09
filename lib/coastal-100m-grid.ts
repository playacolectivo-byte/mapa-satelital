import type {CoastalAnalysisData} from './coastal-analysis.ts';

type Coordinate=[number,number];
export type CoastalGridStation={id:string;chainage_m:number;coordinate:Coordinate;left_profile_id:string;right_profile_id:string;fraction:number;axis:Coordinate;control_reference_coordinates?:[Coordinate,Coordinate]};
export type Coastal100mGrid={version:1;spacing_m:100;method:string;segments:{id:string;municipality:string;method_url?:string;stations:CoastalGridStation[]}[]};

/** Ellipsoidal local metric for short (<500 m) shoreline segments. Validated
 * independently against PROJ/Geod; not a coast-wide degree conversion. */
export function coastalLocalVector(a:Coordinate,b:Coordinate):Coordinate{
 const phi=(a[1]+b[1])*Math.PI/360,e2=6.6943799901413165e-3,w=1-e2*Math.sin(phi)**2;
 return [(b[0]-a[0])*Math.PI/180*6378137/Math.sqrt(w)*Math.cos(phi),(b[1]-a[1])*Math.PI/180*6378137*(1-e2)/w**1.5];
}
export const coastalLocalDistance=(a:Coordinate,b:Coordinate)=>Math.hypot(...coastalLocalVector(a,b));
const mix=(a:Coordinate,b:Coordinate,f:number):Coordinate=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
export function intersectGridNormal(origin:Coordinate,axis:Coordinate,a:Coordinate,b:Coordinate):Coordinate|null{
 const start=coastalLocalVector(origin,a),finish=coastalLocalVector(origin,b),u:Coordinate=[finish[0]-start[0],finish[1]-start[1]];
 const cross=(v:Coordinate,w:Coordinate)=>v[0]*w[1]-v[1]*w[0];
 const denominator=cross(u,axis);if(!Math.hypot(...u)||Math.abs(denominator)<.5*Math.hypot(...u))return null;
 const fraction=-cross(start,axis)/denominator;
 if(!Number.isFinite(fraction)||fraction< -1e-8||fraction>1+1e-8)return null;
 const end=mix(a,b,Math.max(0,Math.min(1,fraction)));
 return coastalLocalDistance(origin,end)<=500?end:null;
}

/** The observed intersections remain immutable controls. The display grid is
 * stationed once on the 2011 polyline, never reselected by year or camera.
 * Later endpoints are spatial interpolations of two explicitly reviewed,
 * same-date photographic controls; unavailable evidence stays without metres. */
export function applyCoastal100mGrid(layer:CoastalAnalysisData,grid:Coastal100mGrid):CoastalAnalysisData{
 const byId=new Map(layer.features.map(f=>[String(f.properties.profile_id),f]));
 const scopes=new Set(grid.segments.filter(s=>s.stations.some(t=>byId.has(t.left_profile_id)||byId.has(t.right_profile_id))).map(s=>s.municipality));
 // Legacy locators without a real 2011 base are retained in the archive,
 // rather than inserted as extra stations outside the 100 m display grid.
 const untouched=layer.features.filter(f=>!scopes.has(String(f.properties.municipality)));
 const sampled:CoastalAnalysisData['features']=[];
 for(const segment of grid.segments){
  if(!scopes.has(segment.municipality))continue;
  const fallback=layer.features.find(f=>String(f.properties.municipality)===segment.municipality)!;
  const methodUrl=segment.method_url??'/data/shorelines/photo-alignment/coastal-100m-grid-method.md';
  for(const station of segment.stations){
   const rightExact=station.fraction>1-1e-9;
   const leftControl=byId.get(rightExact?station.right_profile_id:station.left_profile_id),rightControl=byId.get(rightExact?station.left_profile_id:station.right_profile_id);
   const left=leftControl??fallback,right=rightControl??fallback;
   const a=left.properties,b=right.properties;
   const leftLine=left.geometry.type==='LineString'?left.geometry.coordinates as Coordinate[]:null;
   const rightLine=right.geometry.type==='LineString'?right.geometry.coordinates as Coordinate[]:null;
   const exact=rightExact||station.fraction<1e-9||station.left_profile_id===station.right_profile_id;
   const controls=exact?[left]:[left,right];
   const dated=!!leftControl&&(exact||!!rightControl)&&controls.every(f=>f.properties.photo_interpretation===true&&f.geometry.type==='LineString'&&typeof f.properties.delta_m==='number'&&f.properties.estimated!==true);
   const datesKnown=controls.every(f=>/^20\d\d-\d\d-\d\d$/.test(String(f.properties.date_after))&&Number(String(f.properties.date_after).slice(0,4))===Number(f.properties.year));
   const sameDate=datesKnown&&(exact||a.date_after===b.date_after);
   const sensors=controls.map(f=>(f.properties.photo_sources as {date:string;source:string;provider:string}[]|undefined)?.at(-1));
   const sourcesKnown=sensors.every((c,i)=>!!c&&typeof c.source==='string'&&!!c.source.trim()&&typeof c.provider==='string'&&!!c.provider.trim()&&c.date===controls[i].properties.date_after);
   const sameSensor=sourcesKnown&&(exact||sensors[0]!.source===sensors[1]!.source&&sensors[0]!.provider===sensors[1]!.provider);
   const basesKnown=controls.every(f=>f.properties.baseline_fixed===true&&Number(f.properties.baseline_year)===2011&&String(f.properties.date_before).startsWith('2011-'));
   const pinned=station.control_reference_coordinates;
   const baseOnControls=dated&&(pinned?coastalLocalDistance(leftLine![0],pinned[rightExact?1:0])<.02&&(exact||coastalLocalDistance(rightLine![0],pinned[rightExact?0:1])<.02):coastalLocalDistance(station.coordinate,exact?leftLine![0]:mix(leftLine![0],rightLine![0],station.fraction))<.02);
   const valid=dated&&sameDate&&sameSensor&&basesKnown&&baseOnControls;
   const reference=a.reference_only===true&&(exact||b.reference_only===true);
   const end=valid?(reference?station.coordinate:exact?leftLine![1]:intersectGridNormal(station.coordinate,station.axis,leftLine![1],rightLine![1])):null;
   const common={...a,profile_id:station.id,grid_segment:segment.id,grid_chainage_m:station.chainage_m,grid_spacing_m:100,grid_source_profile_ids:exact?[rightExact?station.right_profile_id:station.left_profile_id]:[station.left_profile_id,station.right_profile_id],grid_spatial_interpolation:!exact,grid_method:grid.method,baseline_coordinate:station.coordinate,baseline_year:2011,baseline_fixed:true,spacing_eligible:true,user_reference_method:null,reference_method_url:methodUrl,method_url:methodUrl};
   if(!valid||!end){
    const reasons=controls.map(control=>control.properties.photo_review_reason).filter(Boolean);
    const reason=!dated?(reasons.length===controls.length&&reasons.every(r=>r===reasons[0])?reasons[0]:'grid_control_pending'):
      !sameDate||!sameSensor?'grid_controls_different_capture':
      valid?'grid_normal_without_bracketed_intersection':'grid_control_pending';
    sampled.push({type:'Feature',id:station.id,geometry:{type:'Point',coordinates:station.coordinate},properties:{...common,delta_m:null,scenario_delta_m:null,estimated:false,photo_interpretation:false,photo_review_pending:true,photo_review_reason:reason,direction_unresolved:true,context_review:true}});
    continue;
   }
   // The zero-year frame uses the stationed polyline itself exactly.
   const vector=coastalLocalVector(station.coordinate,end),length=Math.hypot(...vector);
   const delta=reference?0:length*Math.sign(vector[0]*station.axis[0]+vector[1]*station.axis[1]);
   const errors=controls.map(f=>f.properties.registration_proxy_m);
   const uncertainty=errors.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)?Math.max(...errors as number[])*(exact?1:2):null;
   sampled.push({type:'Feature',id:station.id,geometry:{type:'LineString',coordinates:[station.coordinate,end]},properties:{...common,delta_m:delta,scenario_delta_m:delta,reference_only:reference,estimated:!exact,photo_interpretation:true,photo_review_pending:false,context_review:false,direction_unresolved:uncertainty===null||a.direction_unresolved===true||b.direction_unresolved===true||Math.abs(delta)<=uncertainty,registration_proxy_m:uncertainty,photo_verified_endpoint_releases:[],photo_metadata_points:controls.flatMap(f=>(f.properties.photo_metadata_points as unknown[])??[]),grid_metadata_describes_controls:true}});
  }
 }
 return {...layer,features:[...untouched,...sampled]};
}
