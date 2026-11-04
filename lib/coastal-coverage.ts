import type {CoastalAnalysisData} from './coastal-analysis';
export type SeriesManifest={periods:{year:number;before:number;annual:SeriesEntry;reference2015:SeriesEntry;reference2020?:SeriesEntry}[];cutoff:string};
export type SeriesEntry={source:string;map_path:string;features:number;counts:Record<string,number>;unique_profiles?:number};
export type CoverageState={status:number[];delta_m:(number|null)[];direction_unresolved:boolean[];reference2015?:CoverageState;reference2020?:CoverageState};
export type CoverageYears={profile_ids:string[];years:Record<string,CoverageState>};
export type MunicipalCoverage={municipality:string;total:number;processed:number;estimated:number;unresolved:number};
/** These alongshore segments classify research coverage. They are never dated
 * shorelines and their geometry or width must not be interpreted as retreat. */
export function assessmentCoverage(index:CoastalAnalysisData,years:CoverageYears,year:number,referenceMode:boolean|'2015'|'2020'=false):CoastalAnalysisData{
 const annual=years.years[String(year)];
 const state=referenceMode?annual?.[referenceMode==='2020'?'reference2020':'reference2015']:annual;
 if(index.features.length!==years.profile_ids.length)throw new Error('Inventario de cobertura incompatible');
 return {type:'FeatureCollection',features:index.features.map((feature,i)=>{
   if(String(feature.properties.profile_id)!==years.profile_ids[i])throw new Error('Orden de perfiles incompatible');
   const code=state?.status[i]??0;
   const delta=state?.delta_m[i]??null;
   return {...feature,properties:{...feature.properties,assessment_only:true,assessment_year:year,assessment_reference_year:referenceMode?referenceMode==='2020'?2020:2015:null,assessment_status:code,assessment_delta:delta,estimated:code===2,direction_unresolved:state?.direction_unresolved[i]??true,method_url:'/data/shorelines/series-2015/method.md'}};
 })};
}
export function municipalCoverage(data:CoastalAnalysisData):MunicipalCoverage[]{
 const groups=new Map<string,MunicipalCoverage>();
 for(const feature of data.features){const name=String(feature.properties.municipality??'Atribución pendiente');const value=groups.get(name)??{municipality:name,total:0,processed:0,estimated:0,unresolved:0};value.total++;const code=feature.properties.assessment_status;if(code===1)value.processed++;else if(code===2)value.estimated++;else value.unresolved++;groups.set(name,value);}
 return [...groups.values()].sort((a,b)=>a.municipality.localeCompare(b.municipality,'es'));
}
