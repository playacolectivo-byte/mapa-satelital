import type {LocalEsriCapture} from './esri-captures.ts';

// The photo catalogue and temporal tiles use the same scale ceiling. A
// selected edition's asynchronous tilemap cannot redefine the menu's scope.
export const ESRI_TEMPORAL_MAX_ZOOM=20;
export function esriPhotoMetadataZoom(viewZoom:number,pixelRatio=1):number{
  return Math.max(10,Math.min(ESRI_TEMPORAL_MAX_ZOOM,Math.round(viewZoom)+(pixelRatio>1?1:0)));
}
export type PhotoIntent={chapter:string;year:number;date:string;release:number};
/** Missing metadata is pending verification, never permission to redirect a
 * manually selected photograph. Analysis changes may request an exact year. */
export function analysisPhotoCandidate(captures:LocalEsriCapture[],year:number,currentDate:string|null,chapter:string,intent:PhotoIntent|null,bounds?:{first:number;last:number}):LocalEsriCapture|null{
  if(intent?.chapter===chapter&&intent.year===year)return null;
  if(!currentDate||Number(currentDate.slice(0,4))===year)return null;
  const exact=captures.filter(capture=>capture.year===year).at(-1);
  if(exact)return exact;
  // A chapter change can leave a newer photograph selected. Once its actual
  // date is known, constrain that chapter to its own verified date range.
  // Missing metadata or an ordinary analysis-year change never does this.
  const currentYear=Number(currentDate.slice(0,4));
  if(bounds&&(currentYear<bounds.first||currentYear>bounds.last))return [...captures]
    .filter(capture=>capture.year>=bounds.first&&capture.year<=bounds.last)
    .sort((a,b)=>Math.abs(a.year-year)-Math.abs(b.year-year)||b.date.localeCompare(a.date))[0]??null;
  return null;
}
/** Request order is independent of the analysis year and selected date. Each
 * received local hint is checked at the real point before its date is used. */
export function orderedPhotoHintReleases(values:Record<number,{date:number}>):number[]{
  return Object.entries(values).sort((a,b)=>a[1].date-b[1].date||Number(a[0])-Number(b[0])).map(([release])=>Number(release));
}
