import type {WaybackItem} from '@esri/wayback-core';
import {distinctLocalCaptures,isVerifiedHdYear,type LocalEsriCapture} from './esri-captures.ts';
import type {ReceivedSite} from './esri-catalogue.ts';

export type PhotoReference={name:string;coordinates:[number,number];zoom:number};
export type CoastalPhotoOption=LocalEsriCapture&{reference:PhotoReference;local:boolean};
/** A date audited at another point retains its provenance. These catalogue
 * coordinates are never a command to move the visitor's camera. */
export function coastalPhotoOptions(items:WaybackItem[],sites:ReceivedSite[],center:[number,number],zoom:number,localCaptures:LocalEsriCapture[]=[]):CoastalPhotoOption[]{
 const result=new Map<string,CoastalPhotoOption>();
 const reviewedReleases=new Set(sites.flatMap(site=>Object.keys(site.values).map(Number)));
 const distance=(point:[number,number])=>((point[0]-center[0])*Math.cos(center[1]*Math.PI/180))**2+(point[1]-center[1])**2;
 for(const site of [...sites].sort((a,b)=>distance(a.coordinates)-distance(b.coordinates))){
  for(const capture of distinctLocalCaptures(items,site.values)){
   if(!isVerifiedHdYear(capture.year,capture.year,capture.date,capture.metadata.resolution)||result.has(capture.date))continue;
   result.set(capture.date,{...capture,reference:{name:site.name,coordinates:site.coordinates,zoom:site.zoom},local:false});
  }
 }
 for(const capture of localCaptures)if(isVerifiedHdYear(capture.year,capture.year,capture.date,capture.metadata.resolution)){
  // A new catalogue publication of the same photograph must not silently
  // switch to an edition whose pixels have not been included in the audit.
  const reviewed=capture.editions.filter(item=>reviewedReleases.has(item.releaseNum)).sort((a,b)=>b.releaseDateLabel.localeCompare(a.releaseDateLabel))[0];
  if(!reviewed&&result.has(capture.date))continue;
  result.set(capture.date,{...capture,item:reviewed??capture.item,reference:{name:'Punto actual',coordinates:center,zoom},local:true});
 }
 return [...result.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function photoReferenceView(reference:PhotoReference,pixelRatio=1){
 return {center:reference.coordinates,zoom:Math.max(10,Math.min(20,reference.zoom-(pixelRatio>1?1:0))),bearing:0};
}
export function coastalPhotoForYear(options:CoastalPhotoOption[],year:number,center:[number,number]):CoastalPhotoOption|null{
 const distance=(option:CoastalPhotoOption)=>((option.reference.coordinates[0]-center[0])*Math.cos(center[1]*Math.PI/180))**2+(option.reference.coordinates[1]-center[1])**2;
 return options.filter(option=>option.year===year).sort((a,b)=>Number(b.local)-Number(a.local)||distance(a)-distance(b)||b.date.localeCompare(a.date))[0]??null;
}
