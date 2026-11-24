import hunucma from '../public/data/shorelines/photo-alignment/refinement-hunucma.json' with {type:'json'};
import yobain from '../public/data/shorelines/photo-alignment/refinement-yobain.json' with {type:'json'};
import {applyCoastalMunicipalRefinement,type CoastalMunicipalRefinement} from './coastal-municipal-refinement.ts';
import type {PhotoCoastData} from './photo-coast.ts';

export function applyRegionalShorelineReviews(data:PhotoCoastData,sha:string,slug?:string):PhotoCoastData{
 const reviews=slug==='hunucma'?[hunucma]:slug==='yobain'?[yobain]:slug===undefined?[hunucma,yobain]:[];
 return reviews.reduce((current,review)=>applyCoastalMunicipalRefinement(current,review as CoastalMunicipalRefinement,sha),data);
}
