import type {ReceivedSite} from './esri-catalogue.ts';
import type {WaybackItem} from '@esri/wayback-core';
import {isVerifiedHdYear,type LocalEsriCapture} from './esri-captures.ts';
import type {CoastalPhotoOption} from './esri-coastal-photos.ts';

export type MunicipalCapture={municipality:string;date:string;year:number;coordinates:[number,number];profile_id:string;releases:number[];reference_positions?:number;metadata:{date:number;provider:string;source:string;resolution:number;accuracy:number|null}};
export type MunicipalPhotoAnchor={municipality:string;coordinates:[number,number];profile_id:string;profile_coordinates:[number,number];captures:{year:number;releases:number[]}[];review_scope?:'municipality'|'local';scope_profile_ids?:string[];dated_captures?:MunicipalCapture[];compatible_captures?:(MunicipalCapture&{positions:number})[]};
export type MunicipalPhotoCatalogue={coastal_views:{name:string;bounds:[number,number,number,number];coordinates:[number,number]}[];captures:MunicipalCapture[];compatible_captures:(MunicipalCapture&{positions:number})[];anchors:MunicipalPhotoAnchor[]};
export function municipalPhotoLocation(catalogue:MunicipalPhotoCatalogue,municipality:string):PhotoLocation|null{
 const view=catalogue.coastal_views.find(v=>v.name===municipality);
 return view?{name:municipality,municipality,coordinates:view.coordinates,bounds:view.bounds}:null;
}

/** Municipality associations from the received INEGI locality inventory.
 * Dates below certify sampled points, not complete municipal image coverage. */
const municipalityBySite:Record<string,string>={
 'Celestún':'Celestún','Sisal':'Hunucmá','Chuburná':'Progreso','Chelem':'Progreso',
 'Chelem · consulta original':'Progreso','Progreso':'Progreso','Chicxulub Puerto':'Progreso',
 'El Faro (costa de Ixil)':'Ixil','San Benito':'Dzemul','San Bruno':'Dzemul',
 'Telchac Puerto':'Telchac Puerto','San Crisanto':'Sinanché','Chabihau':'Yobaín',
 'Santa Clara':'Dzidzantún','Dzilam de Bravo':'Dzilam de Bravo','San Felipe':'San Felipe',
 'Río Lagartos':'Río Lagartos','Las Coloradas':'Río Lagartos','El Cuyo':'Tizimín',
};
export type PhotoLocation={name:string;municipality:string;coordinates:[number,number];bounds?:[number,number,number,number]};
export const photoSiteMunicipality=(site:ReceivedSite)=>municipalityBySite[site.name]??null;
const distance=(a:[number,number],b:[number,number])=>((a[0]-b[0])*Math.cos(a[1]*Math.PI/180))**2+(a[1]-b[1])**2;

export function localMetadataBelongsToLocation(center:[number,number],location:PhotoLocation|null,sites:ReceivedSite[]):boolean{
 if(!location)return false;
 const b=location.bounds;
 if(b&&(center[0]<b[0]||center[0]>b[2]||center[1]<b[1]||center[1]>b[3]))return false;
 const nearest=[...sites].sort((a,b)=>distance(a.coordinates,center)-distance(b.coordinates,center))[0];
 return !!nearest&&photoSiteMunicipality(nearest)===location.municipality;
}
export function municipalPhotoYears(catalogue:MunicipalPhotoCatalogue,municipality:string,first:number,last:number):number[]{
 return [...new Set(catalogue.captures.filter(c=>c.municipality===municipality&&c.year>=first&&c.year<=last).map(c=>c.year))].sort((a,b)=>a-b);
}

/** Current-study selectors share this closed set. Reference years remain
 * available, but an interpolated endpoint or a photo without a baseline does
 * not make an additional year selectable. */
function compatibleCaptures(catalogue:MunicipalPhotoCatalogue,municipality:string|null,coordinates?:[number,number],dated=false){
 const center=coordinates??catalogue.coastal_views.find(v=>v.name===municipality)?.coordinates;
 if(!center)return [];
 const anchor=catalogue.anchors.filter(a=>a.municipality===municipality).sort((a,b)=>distance(a.coordinates,center)-distance(b.coordinates,center))[0];
 if(!anchor)return [];
 if(anchor.review_scope)return dated?(anchor.dated_captures??[]).map(c=>({...c,positions:1})):anchor.compatible_captures??[];
 return (dated?catalogue.captures.map(c=>({...c,positions:1})):catalogue.compatible_captures).filter(c=>c.municipality===municipality&&c.positions>0).map(c=>({...c,releases:c.releases.filter(release=>anchor.captures.some(a=>a.year===c.year&&a.releases.includes(release)))})).filter(c=>c.releases.length>0);
}
export function municipalComparisonYears(catalogue:MunicipalPhotoCatalogue,municipality:string|null,first:number,last:number,coordinates?:[number,number]):number[]{
 return [...new Set(compatibleCaptures(catalogue,municipality,coordinates).filter(c=>c.year>=first&&c.year<=last).map(c=>c.year))].sort((a,b)=>a-b);
}
export function compatibleAnalysisYear(years:number[],requested:number):number|null{
 if(years.includes(requested))return requested;
 return years.filter(year=>year<=requested).at(-1)??years[0]??null;
}
export function municipalComparisonOptions(items:WaybackItem[],catalogue:MunicipalPhotoCatalogue,municipality:string|null,_center:[number,number],_zoom:number,scopeCoordinates?:[number,number]):CoastalPhotoOption[]{
 const anchor=scopeCoordinates??catalogue.coastal_views.find(v=>v.name===municipality)?.coordinates;
 if(!anchor)return [];
 const captures=compatibleCaptures(catalogue,municipality,scopeCoordinates);
 return comparisonOptionsForCaptures(items,catalogue,municipality,anchor,captures);
}
function comparisonOptionsForCaptures(items:WaybackItem[],catalogue:MunicipalPhotoCatalogue,municipality:string|null,anchor:[number,number],captures:(MunicipalCapture&{positions:number})[]):CoastalPhotoOption[]{
 const byRelease=new Map(items.map(item=>[item.releaseNum,item]));
 const result:CoastalPhotoOption[]=[];
 for(const year of [...new Set(captures.map(c=>c.year))].sort((a,b)=>a-b)){
  // One reviewed edition per place/year, chosen by actual accepted coverage.
  // Camera position, zoom and late point replies never select a new edition.
  const rows=captures.filter(c=>c.year===year),scores=new Map<number,number>(),references=new Map<number,number>();
  for(const row of rows)for(const release of row.releases)if(byRelease.has(release)){scores.set(release,(scores.get(release)??0)+row.positions);references.set(release,(references.get(release)??0)+(row.reference_positions??0));}
  // Opening the base year must show the photograph used by the fixed points,
  // rather than another capture from that year with a newer publication date.
  const release=[...scores].sort((a,b)=>(references.get(b[0])??0)-(references.get(a[0])??0)||b[1]-a[1]||byRelease.get(b[0])!.releaseDateLabel.localeCompare(byRelease.get(a[0])!.releaseDateLabel)||b[0]-a[0])[0]?.[0];
  if(release===undefined)continue;
  const candidates=municipalPhotoOptions(items,{...catalogue,captures:rows.filter(c=>c.releases.includes(release)).map(c=>({...c,releases:[release]}))},municipality,anchor,17);
  const choice=candidates.sort((a,b)=>distance(a.reference.coordinates,anchor)-distance(b.reference.coordinates,anchor)||b.date.localeCompare(a.date))[0];
  if(choice)result.push(choice);
 }
 return result;
}

/** A dated background remains browsable when no accepted 2010/11 pair exists.
 * Freeze the source choice to the selected place, never to a moving camera.
 * Strict photographic comparisons still use municipalComparisonOptions. */
export function municipalDatedOptions(items:WaybackItem[],catalogue:MunicipalPhotoCatalogue,municipality:string|null,center:[number,number],zoom:number,scopeCoordinates?:[number,number]):CoastalPhotoOption[]{
 const strict=municipalComparisonOptions(items,catalogue,municipality,center,zoom,scopeCoordinates);
 const anchor=scopeCoordinates??catalogue.coastal_views.find(v=>v.name===municipality)?.coordinates;
 if(!anchor)return [];
 const dated=comparisonOptionsForCaptures(items,catalogue,municipality,anchor,compatibleCaptures(catalogue,municipality,scopeCoordinates,true));
 return dated.map(option=>strict.find(c=>c.year===option.year)??option);
}

/** The complete audited municipal year set is available immediately. Live
 * point replies can refine the chosen photo, but never remove its years. */
export function municipalPhotoOptions(items:WaybackItem[],catalogue:MunicipalPhotoCatalogue,municipality:string|null,center:[number,number],zoom:number,local:LocalEsriCapture[]=[]):CoastalPhotoOption[]{
 if(!municipality)return [];
 const byRelease=new Map(items.map(i=>[i.releaseNum,i])),reviewed=new Set(catalogue.captures.flatMap(c=>c.releases));
 const result=new Map<string,CoastalPhotoOption>();
 const refs=catalogue.captures.filter(c=>c.municipality===municipality).sort((a,b)=>distance(a.coordinates,center)-distance(b.coordinates,center));
 for(const ref of refs){
  if(result.has(ref.date))continue;
  const editions=ref.releases.map(id=>byRelease.get(id)).filter((i):i is WaybackItem=>!!i).sort((a,b)=>b.releaseDateLabel.localeCompare(a.releaseDateLabel));
  if(!editions.length||!isVerifiedHdYear(ref.year,ref.year,ref.date,ref.metadata.resolution))continue;
  result.set(ref.date,{key:'esri-capture:'+ref.date,date:ref.date,year:ref.year,item:editions[0],editions,metadata:{...ref.metadata,accuracy:ref.metadata.accuracy??NaN},reference:{name:municipality+' · '+ref.profile_id,coordinates:ref.coordinates,zoom:17},local:false});
 }
 for(const capture of local){
  if(!result.has(capture.date)||!isVerifiedHdYear(capture.year,capture.year,capture.date,capture.metadata.resolution))continue;
  const item=capture.editions.filter(i=>reviewed.has(i.releaseNum)).sort((a,b)=>b.releaseDateLabel.localeCompare(a.releaseDateLabel))[0];
  if(item)result.set(capture.date,{...capture,item,reference:{name:'Punto actual · '+municipality,coordinates:center,zoom},local:true});
 }
 return [...result.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
