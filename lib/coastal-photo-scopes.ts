import type {ReceivedSite} from './esri-catalogue.ts';
import type {WaybackItem} from '@esri/wayback-core';
import {isVerifiedHdYear,type LocalEsriCapture} from './esri-captures.ts';
import type {CoastalPhotoOption} from './esri-coastal-photos.ts';
import celestunReviewed from './generated/celestun-reviewed-photos.json' with {type:'json'};
import ixilReviewed from './generated/ixil-reviewed-photos.json' with {type:'json'};
import progresoCaptures from '../public/data/shorelines/photo-alignment/progreso-capturas-locales-20261116.json' with {type:'json'};
import progresoCoverage from './generated/progreso-edition-coverage.json' with {type:'json'};
import progresoGrid from '../public/data/shorelines/photo-alignment/coastal-100m-grid-20261106.json' with {type:'json'};
import {geometryBounds} from './view.ts';

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
function reviewedProfile(municipality:string,center:[number,number]){
 const ledger=municipality==='Ixil'?ixilReviewed:celestunReviewed;
 const profile=[...ledger.targets].sort((a,b)=>distance(a.coordinates as [number,number],center)-distance(b.coordinates as [number,number],center))[0];
 const preferred=(ledger as {preferred_releases?:Record<string,number[]>}).preferred_releases??{};
 return {...profile,preferred,captures:profile.readings.map(([capture,group])=>{const c=ledger.captures[capture];return {date:c.date,year:Number(c.date.slice(0,4)),releases:ledger.release_groups[group],metadata:{date:Date.parse(c.date+'T00:00:00Z'),provider:c.provider,source:c.source,resolution:c.resolution_m,accuracy:c.accuracy_m}};})};
}


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
 if(municipality==='Celestún'||municipality==='Ixil'){const center=coordinates??catalogue.coastal_views.find(v=>v.name===municipality)?.coordinates;if(!center)return [];const profile=reviewedProfile(municipality,center);return [...new Set(profile.captures.map(c=>c.year).filter(y=>y>=first&&y<=last))].sort((a,b)=>a-b);}
 return [...new Set(compatibleCaptures(catalogue,municipality,coordinates).filter(c=>c.year>=first&&c.year<=last).map(c=>c.year))].sort((a,b)=>a-b);
}
export function compatibleAnalysisYear(years:number[],requested:number):number|null{
 if(years.includes(requested))return requested;
 return years.filter(year=>year<=requested).at(-1)??years[0]??null;
}
export function municipalComparisonOptions(items:WaybackItem[],catalogue:MunicipalPhotoCatalogue,municipality:string|null,_center:[number,number],_zoom:number,scopeCoordinates?:[number,number]):CoastalPhotoOption[]{
 if(municipality==='Celestún'||municipality==='Ixil'){
  const center=scopeCoordinates??_center;
  const profile=reviewedProfile(municipality,center);
  const byRelease=new Map(items.map(item=>[item.releaseNum,item]));
  const result=new Map<number,CoastalPhotoOption>();
  // The closest reviewed coast profile supplies actual dates, never a remote
  // municipal-centre date. A late network reply cannot replace this ledger.
  const captures=[...profile.captures].sort((a,b)=>a.year-b.year||(a.year===2011?a.date.localeCompare(b.date):b.date.localeCompare(a.date)));
  for(const year of [...new Set(captures.map(c=>c.year))]){
   const local=captures.filter(c=>c.year===year);
   // Prefer the edition with the most independently reviewed local profiles.
   // Its acquisition date still comes from this precise profile, not from
   // the municipality centre or the publication date of the tile edition.
   const preferred=profile.preferred[String(year)]?.find(release=>byRelease.has(release)&&local.some(c=>c.releases.includes(release)));
   const c=local.find(c=>preferred!==undefined&&c.releases.includes(preferred))??local[0];
   const editions=c.releases.map(r=>byRelease.get(r)).filter((v):v is WaybackItem=>!!v).sort((a,b)=>b.releaseDateLabel.localeCompare(a.releaseDateLabel));
   if(!editions.length)continue;
   result.set(c.year,{key:municipality+':'+profile.id+':'+c.date,date:c.date,year:c.year,item:editions.find(e=>e.releaseNum===preferred)??editions[0],editions,metadata:{...c.metadata,accuracy:c.metadata.accuracy??NaN},reference:{name:municipality+' · '+profile.id,coordinates:profile.coordinates as [number,number],zoom:17},local:false});
  }
  return [...result.values()].sort((a,b)=>a.year-b.year);
 }
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
  if(!choice)continue;
  result.push(choice);
 }
 return result;
}

/** Geographic extent of the verified 2025 alternative near the inlet. */
const chuburnaAnchor: [number, number] = [-89.8162133, 21.2518533];
const chuburnaCaptureDate = '2025-02-13';
const localCaptures: Record<string, { date: string; alternative_date?: string }> = progresoCaptures.stations;
const inletStations = progresoGrid.segments
 .filter(segment => segment.municipality === 'Progreso')
 .flatMap(segment => segment.stations)
 .filter(station => localCaptures[station.id]?.alternative_date === chuburnaCaptureDate);
const inletBounds = geometryBounds({ type: 'MultiPoint', coordinates: inletStations.map(station => station.coordinate) });

export function viewCentersOnChuburnaInlet(viewportCenter: [number, number] | null): boolean {
 if (!viewportCenter || !inletBounds) return false;
 const [longitude, latitude] = viewportCenter;
 const [west, south, east, north] = inletBounds;
 // Include water and land around the reviewed inlet stations.
 return longitude >= west - .009 && longitude <= east + .009 &&
  latitude >= south - .013 && latitude <= north + .013;
}

type ProgresoYearCoverage = {
 frames: Record<string, number[]>;
 additionalCaptures?: MunicipalCapture[];
};

export function progresoStationPhoto(items: WaybackItem[], catalogue: MunicipalPhotoCatalogue, year: number, release: number, date: string): CoastalPhotoOption | null {
 const additional=(progresoCoverage.years as Record<string,ProgresoYearCoverage>)[year]?.additionalCaptures??[];
 const overview=catalogue.coastal_views.find(view=>view.name==='Progreso')?.coordinates;
 if(!overview)return null;
 const captures=[...compatibleCaptures(catalogue,'Progreso',overview,true),...additional.map(capture=>({...capture,positions:1}))];
 const match=captures.find(capture=>capture.date===date&&capture.year===year&&capture.releases.includes(release));
 if(!match)return null;
 return comparisonOptionsForCaptures(items,catalogue,'Progreso',match.coordinates,[{...match,releases:[release]}])[0]??null;
}

export function progresoReviewedPhotoOptions(items:WaybackItem[],catalogue:MunicipalPhotoCatalogue,coordinates:[number,number],chuburnaInlet=false,sectorLongitude?:number):CoastalPhotoOption[]{
 const municipality='Progreso';
 const overview=catalogue.coastal_views.find(view=>view.name===municipality)?.coordinates??coordinates;
 const whole=compatibleCaptures(catalogue,municipality,overview,true);
 const reviewed=compatibleCaptures(catalogue,municipality,coordinates);
 const proven=new Map(comparisonOptionsForCaptures(items,catalogue,municipality,coordinates,reviewed).map(option=>[option.year,option]));
 const knownYears=progresoCoverage.years as Record<string,ProgresoYearCoverage>;
 const candidates=[...whole,...Object.values(knownYears).flatMap(year=>(year.additionalCaptures??[]).map(capture=>({...capture,positions:1})))];
 const dated=comparisonOptionsForCaptures(items,catalogue,municipality,coordinates,candidates);
 const sector=sectorLongitude===undefined?undefined:Math.floor(sectorLongitude/progresoCoverage.longitudeStep)-progresoCoverage.firstSector;
 const sectorAnchor:[number,number]=sectorLongitude===undefined?coordinates:[sectorLongitude,coordinates[1]];
 const local = chuburnaInlet ? comparisonOptionsForCaptures(items,catalogue,municipality,chuburnaAnchor,compatibleCaptures(catalogue,municipality,chuburnaAnchor)) : [];
 return dated.map(fallback=>{
  const year=fallback.year;
  const inletDate=year===2025?chuburnaCaptureDate:year===2026?'2026-02-07':null;
  const inlet=local.find(option=>option.date===inletDate);
  if(inlet)return inlet;
  const preferred=proven.get(year)??fallback;
  if(year===2011)return {...preferred,referenceOnly:true};
  if(sector===undefined)return preferred;
  const frames=knownYears[String(year)]?.frames??{};
  const score=(release:number)=>frames[release]?.[sector]??0;
  const release=Object.keys(frames).map(Number).sort((a,b)=>score(b)-score(a))[0];
  // Keep the ordinary choice when local coverage ties.
  if(release===undefined||score(release)<=score(preferred.item.releaseNum))return preferred;
  const matches=candidates.filter(capture=>capture.year===year&&capture.releases.includes(release)).map(capture=>({...capture,releases:[release]}));
  return comparisonOptionsForCaptures(items,catalogue,municipality,sectorAnchor,matches)[0]??preferred;
 });
}

/** A dated background remains browsable when no accepted 2010/11 pair exists.
 * Freeze the source choice to the selected place, never to a moving camera.
 * Strict photographic comparisons still use municipalComparisonOptions. */
export function municipalDatedOptions(items:WaybackItem[],catalogue:MunicipalPhotoCatalogue,municipality:string|null,center:[number,number],zoom:number,scopeCoordinates?:[number,number]):CoastalPhotoOption[]{
 const strict=municipalComparisonOptions(items,catalogue,municipality,center,zoom,scopeCoordinates);
 if(municipality==='Celestún'||municipality==='Ixil')return strict;
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
