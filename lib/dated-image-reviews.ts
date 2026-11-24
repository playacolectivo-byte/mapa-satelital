import celestun from './generated/celestun-review-version.json' with {type:'json'};
import ixil from './generated/ixil-review-version.json' with {type:'json'};
export type DatedReviewVersion={method:string;revision:number;municipality:string;profiles:number;capture_dates:number;sha256:string;url:string;method_url:string;rejection_reason:string;profile_ids?:string[];tile_zoom_limits?:Record<number,number>};
export const datedImageReviews:DatedReviewVersion[]=[{...celestun,municipality:'Celestún',profiles:379,capture_dates:24,rejection_reason:'celestun_image_not_interpretable'},{...ixil,rejection_reason:'ixil_image_not_interpretable'}];
export const datedReviewForMunicipality=(name:string|null)=>datedImageReviews.find(r=>r.municipality===name);
export const datedReviewForMethod=(method:string)=>datedImageReviews.find(r=>r.method===method);

const datedProfileIds=new Set(datedImageReviews.flatMap(review=>review.profile_ids??[]));
export const isDatedReviewProfile=(id:string,municipality:string)=>datedProfileIds.has(id)||datedImageReviews.some(review=>!review.profile_ids&&review.municipality===municipality);
