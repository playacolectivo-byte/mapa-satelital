import type {CoastalScenario} from './coastal-scenario.ts';
import type {PhotoCoastData} from './photo-coast.ts';
import {coastalAuditForReading} from './coastal-audit-provenance.ts';
import {datedReviewForMethod} from './dated-image-reviews.ts';

/** Keep the raster on the exact native level used by a dated interpretation.
 * Enlargement is allowed; switching to another native tile is not evidence
 * that the same pixels or capture date were reviewed. This changes delivery
 * only, never the measured offsets or the selected edition. */
export function reviewedEsriTileZoomLimits(
 model:Pick<CoastalScenario,'targets'>|null,
 photos:PhotoCoastData|null,
 municipality:string|null,
 declared:Readonly<Record<number,number>>|undefined,
):Record<number,number>|undefined {
 const limits:Record<number,number>={...declared};
 if(model&&photos&&municipality){
  const ids=new Set(model.targets.filter(t=>t.m===municipality).map(t=>t.id));
  for(const target of photos.targets){
   if(!ids.has(target.id))continue;
   for(const reading of target.readings){
    if(!reading.accepted||reading.offset_m===null)continue;
    for(const release of reading.releases){
     const audited=!!coastalAuditForReading(reading,release);
     const dated=!!datedReviewForMethod(reading.manual_review?.id??'');
     if(!audited&&!dated)continue;
     // An explicit z18 interpretation remains usable unless another reviewed
     // point in this same municipality and edition is supported only at z17.
     const level=reading.detail_offsets?.some(([r])=>r===release)?18:17;
     limits[release]=Math.min(limits[release]??level,level);
    }
   }
  }
 }
 return Object.keys(limits).length?limits:undefined;
}

export function reviewedEsriMetadataZoom(requested:number,nativeLimit:number|undefined){
 return Math.min(requested,nativeLimit??requested);
}
