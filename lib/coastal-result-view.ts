import {scenarioComparison,type CoastalScenario} from './coastal-scenario.ts';
import type {CoastalAnalysisData} from './coastal-analysis.ts';
import type {CoastalPhotoOption} from './esri-coastal-photos.ts';

export type CoastalResultView='scenario'|'photos';
export const SCENARIO_YEARS=Array.from({length:17},(_,i)=>2010+i);

/** An estimate exists independently of a photograph. An exact local year may
 * select its image; otherwise retain the explicitly dated reference image.
 * Never rename a neighbouring photograph as the missing analysis year. */
export function scenarioReferencePhoto(options:CoastalPhotoOption[],year:number,previousRelease:number|null):CoastalPhotoOption|null{
 return options.find(option=>option.year===year)
  ??options.find(option=>option.item.releaseNum===previousRelease)
  ??options.at(-1)??null;
}

/** The restored model is immutable. Retain three computed years, independent
 * of camera motion, metadata arrival and raster loading. */
export function createScenarioLayerCache(model:CoastalScenario){
 const cache=new Map<number,CoastalAnalysisData>();
 return {read(year:number){
  if(!SCENARIO_YEARS.includes(year))throw new Error('Año de estimación fuera de rango');
  const cached=cache.get(year);
  if(cached){cache.delete(year);cache.set(year,cached);return cached;}
  const layer=scenarioComparison(model,2010,year);cache.set(year,layer);
  while(cache.size>3)cache.delete(cache.keys().next().value!);
  return layer;
 }};
}
