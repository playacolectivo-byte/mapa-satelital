import {isDatedReviewProfile} from './dated-image-reviews.ts';
import type {CoastalAnalysisData} from './coastal-analysis.ts';

type Coordinate=[number,number];
export type CoastalGridStation={id:string;chainage_m:number;coordinate:Coordinate;left_profile_id:string;right_profile_id:string;fraction:number;axis:Coordinate;control_reference_coordinates?:[Coordinate,Coordinate]};
export type Coastal100mGrid={version:1;spacing_m:100;method:string;segments:{id:string;municipality:string;method_url?:string;stations:CoastalGridStation[]}[]};

const WGS84_E2=6.6943799901413165e-3;
const meridianMetres=(degrees:number,weight:number)=>degrees*Math.PI/180*6378137*(1-WGS84_E2)/weight**1.5;

/** Ellipsoidal local metric for short (<500 m) shoreline segments. Validated
 * independently against PROJ/Geod; not a coast-wide degree conversion. */
export function coastalLocalVector(a:Coordinate,b:Coordinate):Coordinate{
 const phi=(a[1]+b[1])*Math.PI/360,w=1-WGS84_E2*Math.sin(phi)**2;
 return [(b[0]-a[0])*Math.PI/180*6378137/Math.sqrt(w)*Math.cos(phi),meridianMetres(b[1]-a[1],w)];
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

export type CoastalSamplingReference = { coordinate: Coordinate; municipality: string };
type SamplingStation = { id: string; chainage_m: number; coordinate: Coordinate; municipality?: string };
type SamplingSegment = { id: string; municipality: string; stations: SamplingStation[] };

const STATION_SPACING_M = 100;
const STATION_RADIUS_M = 48;
const MIN_DISPLAY_SEPARATION_M = 50;
const MAX_REFERENCE_GAP_M = 180;

/** Build a fixed sampling line for the east–west Ixil corridor from its
 * reviewed photo references. Split the chain where the reference has gaps. */
export function ixilSamplingSegments(references: CoastalSamplingReference[]): SamplingSegment[] {
 const ordered = [...references].sort((a, b) => a.coordinate[0] - b.coordinate[0]);
 const segments: SamplingSegment[] = [];
 let segment: SamplingSegment | undefined;
 let length = 0;
 for (const [index, right] of ordered.entries()) {
  const left = ordered[index - 1];
  const edge = left ? coastalLocalDistance(left.coordinate, right.coordinate) : Infinity;
  if (!segment || !left || edge > MAX_REFERENCE_GAP_M) {
   const id = 'sampling-ixil-' + (segments.length + 1);
   segment = { id, municipality: 'Ixil', stations: [{ id: id + '-0', chainage_m: 0, ...right }] };
   segments.push(segment);
   length = 0;
   continue;
  }
  let next = segment.stations.length * STATION_SPACING_M;
  while (next <= length + edge) {
   const fraction = (next - length) / edge;
   segment.stations.push({
    id: segment.id + '-' + next, chainage_m: next,
    coordinate: mix(left.coordinate, right.coordinate, fraction),
    municipality: fraction < .5 ? left.municipality : right.municipality,
   });
   next += STATION_SPACING_M;
  }
  length += edge;
 }
 return segments;
}

type MeasuredProfile = CoastalAnalysisData['features'][number] & { geometry: { type: 'LineString'; coordinates: Coordinate[] } };
function isMeasuredProfile(feature: CoastalAnalysisData['features'][number]): feature is MeasuredProfile {
 const p = feature.properties;
 return feature.geometry.type === 'LineString' && feature.geometry.coordinates.length === 2 &&
  p.photo_interpretation === true && p.photo_review_pending !== true && p.context_review !== true &&
  p.estimated !== true && p.photo_start_kind === 'photo' && p.photo_end_kind === 'photo' &&
  typeof p.delta_m === 'number' && Number.isFinite(p.delta_m);
}

/** Assign at most one compatible photographed profile to its nearest
 * station. Keep both photographed endpoints, provenance and metres intact. */
export function sampleObservedCoast(
 layer: CoastalAnalysisData, segments: SamplingSegment[], year: number, referenceYear?: number,
): CoastalAnalysisData {
 const slots = segments.flatMap(segment => segment.stations.map(station => ({
  station, segment, candidates: [] as { feature: MeasuredProfile; distance: number }[],
 })));
 for (const feature of layer.features) {
  if (!isMeasuredProfile(feature)) continue;
  if (referenceYear !== undefined &&
    (typeof feature.properties.date_before !== 'string' || !feature.properties.date_before.startsWith(referenceYear + '-'))) continue;
  let nearest: typeof slots[number] | undefined;
  let distance = STATION_RADIUS_M;
  for (const slot of slots) {
   const delta = coastalLocalDistance(feature.geometry.coordinates[0], slot.station.coordinate);
   if (delta < distance) { nearest = slot; distance = delta; }
  }
  nearest?.candidates.push({ feature, distance });
 }

 const selected = new Map<string, typeof slots[number]['candidates'][number]>();
 const close = (a: MeasuredProfile, b: MeasuredProfile) =>
  coastalLocalDistance(a.geometry.coordinates[0], b.geometry.coordinates[0]) < MIN_DISPLAY_SEPARATION_M ||
  coastalLocalDistance(a.geometry.coordinates[1], b.geometry.coordinates[1]) < MIN_DISPLAY_SEPARATION_M;
 const candidates = slots.flatMap(({ station, candidates: list }) => list.map(entry => ({ ...entry, station })));
 const hasEndpointAudit = (feature: MeasuredProfile) => feature.properties.photo_endpoint_audit !== undefined;
 candidates.sort((a, b) => Number(hasEndpointAudit(b.feature)) - Number(hasEndpointAudit(a.feature)) ||
  a.distance - b.distance || String(a.feature.id).localeCompare(String(b.feature.id)));
 for (const candidate of candidates) {
  if (selected.has(candidate.station.id) || [...selected.values()].some(other => close(candidate.feature, other.feature))) continue;
  selected.set(candidate.station.id, candidate);
 }

 return { ...layer, features: slots.map(({ station, segment }) => {
  const match = selected.get(station.id);
  const sampling = {
   sampling_station: true, sampling_station_id: station.id, sampling_coordinate: station.coordinate,
   grid_segment: segment.id, grid_chainage_m: station.chainage_m, grid_spacing_m: STATION_SPACING_M,
  };
  if (match) return {
   ...match.feature,
   properties: { ...match.feature.properties, ...sampling, sampling_profile_distance_m: match.distance },
  };
  return {
   type: 'Feature', id: station.id, geometry: { type: 'Point', coordinates: station.coordinate },
   properties: {
    ...sampling, profile_id: station.id, municipality: station.municipality ?? segment.municipality, year,
    sampling_gap: true, photo_review_pending: true, delta_m: null,
   },
  };
 }) };
}

/** The observed intersections remain immutable controls. The display grid is
 * stationed once on the 2011 polyline, never reselected by year or camera.
 * Later endpoints are spatial interpolations of two explicitly reviewed,
 * same-date photographic controls; unavailable evidence stays without metres. */
export function applyCoastal100mGrid(layer:CoastalAnalysisData,grid:Coastal100mGrid):CoastalAnalysisData{
 const protectedIds=new Set(layer.features.filter(f=>f.properties.photo_audit_preserve_control===true||isDatedReviewProfile(String(f.properties.profile_id),String(f.properties.municipality))).map(f=>String(f.properties.profile_id)));
 // Approval of a photographed control cannot be transferred to a new point
 // on the chord between its neighbours. Preserve the observed geometry.
 const eligibleGrid={...grid,segments:grid.segments.map(segment=>({...segment,stations:segment.stations.filter(station=>!protectedIds.has(station.left_profile_id)&&!protectedIds.has(station.right_profile_id)&&!isDatedReviewProfile(station.left_profile_id,segment.municipality)&&!isDatedReviewProfile(station.right_profile_id,segment.municipality))}))};
 const byId=new Map(layer.features.map(f=>[String(f.properties.profile_id),f]));
 const scopes=new Set(eligibleGrid.segments.filter(s=>s.stations.some(t=>byId.has(t.left_profile_id)||byId.has(t.right_profile_id))).map(s=>s.municipality));
 // Legacy locators without a real 2011 base are retained in the archive,
 // rather than inserted as extra stations outside the 100 m display grid.
 const untouched=layer.features.filter(f=>protectedIds.has(String(f.properties.profile_id))||!scopes.has(String(f.properties.municipality)));
 const sampled:CoastalAnalysisData['features']=[];
 for(const segment of eligibleGrid.segments){
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
