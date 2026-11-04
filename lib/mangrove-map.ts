import {getMunicipalJson,type MunicipalityScope} from './municipal-pages';
import { dataAssetBytes } from './data-delivery';
import { ResourceCache } from './resource-cache';
import { isEvidenceData, type EvidenceData } from './map-evidence';

const cache=new ResourceCache<EvidenceData>(3,4*1024*1024);

/** A cached year contains unchanged GMW features, never a temporal estimate. */
export async function loadMangroveYear(year:number,signal:AbortSignal,scope?:MunicipalityScope):Promise<EvidenceData>{
  if(!Number.isInteger(year))throw new Error('Año de manglar inválido');
  const path='problems/gmw/map/years/'+year+'.geojson';
  return cache.read((scope?.municipality.slug??'all')+':'+path,signal,async sharedSignal=>{
    const data=await getMunicipalJson<unknown>(scope,path,sharedSignal);
    if(!isEvidenceData(data) || data.features.some(feature=>feature.properties.year!==year || feature.properties.source_id!=='GMW4112'))throw new Error('Corte anual de manglar inválido');
    return data;
  },dataAssetBytes(path));
}
