import progreso from '../public/data/shorelines/photo-alignment/manual-progreso-full-20261105.json' with {type:'json'};
import hunucma from '../public/data/shorelines/photo-alignment/manual-hunucma-20261105.json' with {type:'json'};
import dzemul from '../public/data/shorelines/photo-alignment/manual-dzemul-20261105.json' with {type:'json'};
import refinement from '../public/data/shorelines/photo-alignment/reference-refinement-20261106.json' with {type:'json'};
import {applyMunicipalShorelineReview,type MunicipalShorelineReview} from './municipal-shoreline-review.ts';
import {applyShorelineReferenceRefinement,type ShorelineReferenceRefinement} from './shoreline-reference-refinement.ts';
import type {PhotoCoastData} from './photo-coast.ts';
export function applyCurrentMunicipalReviews(data:PhotoCoastData,sha:string):PhotoCoastData{
 const reviewed=[progreso,hunucma,dzemul].reduce((result,review)=>applyMunicipalShorelineReview(result,review as MunicipalShorelineReview,sha),data);
 return applyShorelineReferenceRefinement(reviewed,refinement as ShorelineReferenceRefinement,sha);
}
