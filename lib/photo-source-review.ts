import type {CoastalAnalysisData} from './coastal-analysis.ts';
export type PhotoSourceReview={version:number;algorithm:string;model_sha256:string;data_sha256:string;blocked:{release:number;profile_id:string;kind:string;actual:[string,string,number]|null;position:number[];reason:string}[]};

/** A failure in source identity is not permission to relabel an image or
 * replace its result. It only suppresses the incompatible photographed bar. */
export function compatibleSourceLayer(layer:CoastalAnalysisData,release:number|null,review:PhotoSourceReview):CoastalAnalysisData{
 if(release===null)return layer;
 const blocked=new Set(review.blocked.filter(r=>r.release===release&&r.kind==='photo').map(r=>r.profile_id));
 if(!blocked.size)return layer;
 return {...layer,features:layer.features.filter(f=>!blocked.has(String(f.id))||Array.isArray(f.properties.photo_verified_endpoint_releases)&&f.properties.photo_verified_endpoint_releases.includes(release))};
}
