import data from '../public/data/shorelines/photo-alignment/hunucma-yobain-alternatives.json' with {type:'json'};

type Source={label:string;date:string;resolution_m:number;url:string;product_id:string};
type Range={id:string;source:string;interval_m:[number,number]};
type Reference=Range&{municipality:'hunucma';origin:[number,number];azimuth:number};
type Comparison=Range&{municipality:'hunucma'|'yobain';reference_date:string};
type Catalogue={municipality:'hunucma'|'yobain';id:string;sources:string[]};
type Pending={id:string;source:string;reason:string};

export const regionalShorelineAlternatives=data as unknown as {
 version:1;grid_sha256:string;sources:Record<string,Source>;references:Reference[];comparisons:Comparison[];catalogue:Catalogue[];pending:Pending[];
};
export const regionalAlternativeMethod='/data/shorelines/photo-alignment/hunucma-yobain-alternatives.md';

const byStationYear=new Map<string,Comparison[]>();
const scopeYears=new Map<string,Set<number>>();
for(const comparison of regionalShorelineAlternatives.comparisons){
 const date=regionalShorelineAlternatives.sources[comparison.source].date;
 const key=comparison.id+':'+date.slice(0,4);
 const years=scopeYears.get(comparison.municipality)??new Set<number>();
 years.add(Number(date.slice(0,4)));
 scopeYears.set(comparison.municipality,years);
 const rows=byStationYear.get(key)??[];
 rows.push(comparison);
 byStationYear.set(key,rows);
}
export function hasRegionalAlternativeYear(municipality:string|undefined,year:number){
 return regionalAlternativeYears(municipality).includes(year);
}
export function regionalAlternativeYears(municipality:string|undefined){
 const scope=municipality==='Hunucmá'?'hunucma':municipality==='Yobaín'?'yobain':'';
 return [...(scopeYears.get(scope)??[])];
}
export function regionalAlternativeComparisons(id:string,year:number){
 return (byStationYear.get(id+':'+year)??[]).map(row=>({...row,capture:regionalShorelineAlternatives.sources[row.source]}));
}
const pendingReasons:Record<string,string>={
 cloud_or_shadow_within_manual_bracket:'Nubes o sombras sobre el borde.',
 inlet_and_structure_in_the_mixed_10m_pixels:'La bocana o las obras se mezclan con el borde.',
 headland_and_multiple_intertidal_surfaces_in_the_mixed_10m_pixels:'Hay varios bordes posibles en la punta de arena.',
 road_breach_and_multiple_intertidal_surfaces_in_the_mixed_10m_pixels:'El corte del camino y las superficies inundadas ocultan el frente de playa.',
};
export const regionalAlternativePendingReason=(reason:string)=>pendingReasons[reason]??'El contacto entre el agua y la arena no se distingue en esa captura.';
