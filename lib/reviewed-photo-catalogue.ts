import type {CoastalScenario,ScenarioTarget} from './coastal-scenario.ts';
import {photoCoastCoordinate,type PhotoCoastData,type PhotoCoastTarget} from './photo-coast.ts';
import type {MunicipalCapture,MunicipalPhotoAnchor,MunicipalPhotoCatalogue} from './coastal-photo-scopes.ts';

type Dated=MunicipalCapture&{capture:number;reference:boolean};
type Comparable=MunicipalCapture&{positions:number};
const metres=(a:[number,number],b:[number,number])=>Math.hypot((a[0]-b[0])*Math.cos((a[1]+b[1])*Math.PI/360),a[1]-b[1])*Math.PI/180*6371008.8;
const samePoint=(a:[number,number],b:[number,number])=>metres(a,b)<.01;

/** Build camera choices from explicit local observations and review policies.
 * A municipal camera sees its complete municipality; a named local camera sees
 * only profiles within 2 km. Its dates never borrow coverage from a distant town.
 * Dated browsing is retained separately from approved 2011/photo pairs. */
export function withReviewedPhotoCatalogue(base:MunicipalPhotoCatalogue,model:CoastalScenario,photos:PhotoCoastData):MunicipalPhotoCatalogue{
 if(model.targets.length!==photos.targets.length||model.targets.some((t,i)=>t.id!==photos.targets[i].id))throw new Error('Inventario fotográfico incompatible');
 const reviewed=new Set(model.targets.filter((_,i)=>photos.targets[i].review_policy?.reviewed_captures!==undefined).map(t=>t.m));
 const byMunicipality=new Map<string,{target:ScenarioTarget;row:PhotoCoastTarget}[]>();
 model.targets.forEach((target,i)=>{if(reviewed.has(target.m)&&(target.type.startsWith('Playa')||photos.targets[i].reviewed_beach_control)){const rows=byMunicipality.get(target.m)??[];rows.push({target,row:photos.targets[i]});byMunicipality.set(target.m,rows);}});
 const aggregate=(rows:Dated[],center:[number,number]):Comparable[]=>{
  const groups=new Map<string,Comparable>();
  for(const row of rows){
   const releases=[...new Set(row.releases)].sort((a,b)=>a-b);if(!releases.length)continue;
   const key=row.capture+':'+releases.join(',');const previous=groups.get(key);
   if(previous){previous.positions++;previous.reference_positions=(previous.reference_positions??0)+(row.reference?1:0);if(metres(row.coordinates,center)<metres(previous.coordinates,center)){const {positions,reference_positions}=previous;groups.set(key,{...row,releases,positions,reference_positions});}}
   else groups.set(key,{...row,releases,positions:1,reference_positions:row.reference?1:0});
  }
  return [...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.profile_id.localeCompare(b.profile_id)||a.releases[0]-b.releases[0]);
 };
 const scoped=(municipality:string,center:[number,number],whole:boolean)=>{
  const pairs=(byMunicipality.get(municipality)??[]).filter(({target})=>whole||metres(target.p,center)<=2000);
  const dated:Dated[]=[],compatible:Dated[]=[];
  for(const {target,row} of pairs)for(const reading of row.readings){
   const capture=photos.captures[reading.capture];if(!capture||capture.resolution_m>1||!reading.releases.length)continue;
   const approved=[...new Set((row.review_policy?.reviewed_captures??[]).filter(r=>r.capture===reading.capture).flatMap(r=>r.releases))].filter(r=>reading.releases.includes(r));
   const entry:Dated={municipality,date:capture.date,year:Number(capture.date.slice(0,4)),capture:reading.capture,reference:row.fixed_reference?.capture===reading.capture,profile_id:target.id,coordinates:target.p,releases:reading.releases,metadata:{date:Date.parse(capture.date+'T00:00:00Z'),provider:capture.provider,source:capture.source,resolution:capture.resolution_m,accuracy:capture.accuracy_m}};
   dated.push(entry);
   if(reading.accepted&&reading.offset_m!==null&&approved.length&&!row.reference_unavailable&&row.fixed_reference&&row.review_policy&&entry.year>=row.review_policy.first_year&&entry.year<=row.review_policy.last_year){
    compatible.push({...entry,coordinates:photoCoastCoordinate(target,reading.offset_m),releases:approved});
   }
  }
  return {profile_ids:pairs.map(p=>p.target.id),dated:aggregate(dated,center),compatible:aggregate(compatible,center)};
 };
 const municipal=new Map(base.coastal_views.filter(v=>reviewed.has(v.name)).map(v=>[v.name,scoped(v.name,v.coordinates,true)]));
 const anchors:MunicipalPhotoAnchor[]=base.anchors.map(anchor=>{
  if(!reviewed.has(anchor.municipality))return anchor;
  const view=base.coastal_views.find(v=>v.name===anchor.municipality);if(!view)return anchor;
  const whole=samePoint(anchor.coordinates,view.coordinates);const scope=whole?municipal.get(view.name)!:scoped(view.name,anchor.coordinates,false);
  return {...anchor,review_scope:whole?'municipality':'local',scope_profile_ids:scope.profile_ids,dated_captures:scope.dated,compatible_captures:scope.compatible,captures:scope.dated.map(c=>({year:c.year,releases:c.releases}))};
 });
 return {...base,captures:[...base.captures.filter(c=>!reviewed.has(c.municipality)),...[...municipal.values()].flatMap(s=>s.dated)],compatible_captures:[...base.compatible_captures.filter(c=>!reviewed.has(c.municipality)),...[...municipal.values()].flatMap(s=>s.compatible)],anchors};
}
