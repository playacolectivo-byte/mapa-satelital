import type {PhotoCoastData} from './photo-coast.ts';
import {applyDatedImageReview,type DatedImageReview} from './dated-image-review.ts';
export type CelestunImageReview=DatedImageReview;
export function applyCelestunImageReview(data:PhotoCoastData,review:CelestunImageReview,originalSha:string):PhotoCoastData{
 return applyDatedImageReview(data,review,originalSha,{municipality:'Celestún',method:'celestun-dated-image-review-20261105',rejection_reason:'celestun_image_not_interpretable'});
}
