import type {CoastalAnalysisData} from './coastal-analysis.ts';

export type ScenarioTarget={id:string;parent:string;m:string;p:[number,number];v:[number,number];type:string;municipality_approximate:boolean;d:number[];support:number[][]};
export type CoastalScenario={version:1;scenario_unvalidated:true;years:number[];anchorYears:number[];sources:{id:string;m:string;p:[number,number]}[];anchors:(number|null)[][];targets:ScenarioTarget[];coordinate_scale:[number,number];source_hashes:Record<string,string>;municipalities:string[]};
export function validateCoastalScenario(value:unknown):CoastalScenario{
 const m=value as CoastalScenario;
 if(!m||m.version!==1||m.scenario_unvalidated!==true||m.years?.length!==17||m.years[0]!==2010||m.years[16]!==2026||!m.targets?.length||m.municipalities?.length!==13)throw new Error('Escenario costero incompatible');
 const ids=new Set<string>();
 for(const t of m.targets){if(ids.has(t.id)||t.d?.length!==17||!t.d.every(Number.isFinite)||t.p?.length!==2||!t.p.every(Number.isFinite)||t.v?.length!==2||Math.abs(Math.hypot(...t.v)-1)>1e-5||t.support?.length!==m.anchorYears.length||t.support.some(ids=>!ids.length||ids.some(i=>!Number.isInteger(i)||i<0||i>=m.sources.length)))throw new Error('Perfil de escenario inválido');ids.add(t.id);}
 return m;
}
function temporalYears(model:CoastalScenario,year:number):number[]{
 const hi=model.anchorYears.findIndex(y=>y>=year);
 return hi<0?[model.anchorYears.at(-1)!]:hi===0||model.anchorYears[hi]===year?[model.anchorYears[hi]]:[model.anchorYears[hi-1],model.anchorYears[hi]];
}
/** Distances are graphic offsets from the received cartography. These are
 * hypothetical scenarios, never independently measured historical shorelines. */
export function scenarioComparison(model:CoastalScenario,before:number,year:number):CoastalAnalysisData{
 if(year<2010||year>2026||before>year||before<2009)throw new Error('Periodo de escenario fuera de rango');
 const range=model.years.filter(y=>y>before&&y<=year);
 const used=[...new Set(range.flatMap(y=>temporalYears(model,y)))];
 return {type:'FeatureCollection',features:model.targets.map(t=>{
  const delta=range.reduce((sum,y)=>sum+t.d[model.years.indexOf(y)],0);
  const cumulative=(y:number)=>y<2010?-t.d[0]:model.years.reduce((sum,v,j)=>sum+(v>2010&&v<=y?t.d[j]:0),0);
  const anchor=cumulative(2025);
  const position=(y:number):[number,number]=>[t.p[0]+t.v[0]*(cumulative(y)-anchor)/model.coordinate_scale[0],t.p[1]+t.v[1]*(cumulative(y)-anchor)/model.coordinate_scale[1]];
  // Keep popup samples small; the downloadable model preserves all donors.
  const support=[...new Set([used[0],used.at(-1)].filter((y):y is number=>y!==undefined))].map(y=>{const k=model.anchorYears.indexOf(y);const ids=t.support[k],weights=ids.map(i=>{const p=model.sources[i].p,dx=(p[0]-t.p[0])*model.coordinate_scale[0],dy=(p[1]-t.p[1])*model.coordinate_scale[1];return 1/Math.max(250,Math.hypot(dx,dy))**2;});const total=weights.reduce((a,b)=>a+b,0);return {year:y,rows:ids.map((i,j)=>({id:model.sources[i].id,value:model.anchors[k][i],weight:weights[j]/total,distance_m:Math.sqrt(((model.sources[i].p[0]-t.p[0])*model.coordinate_scale[0])**2+((model.sources[i].p[1]-t.p[1])*model.coordinate_scale[1])**2)}))};});
  return {type:'Feature' as const,id:t.id,geometry:{type:'LineString' as const,coordinates:[position(before),position(year)]},properties:{profile_id:t.id,parent_profile_id:t.parent,municipality:t.m,municipality_is_approximate:t.municipality_approximate,coast_type:t.type,year,baseline_year:before,comparison_start_year:before,comparison_end_year:year,delta_m:delta,scenario_delta_m:delta,reference_only:before===year,estimated:true,scenario_unvalidated:true,direction_unresolved:true,scenario_support:support,scenario_support_years:used,scenario_extrapolated:range.some(y=>y<model.anchorYears[0]||y>model.anchorYears.at(-1)!),scenario_temporal_interpolation:range.some(y=>y>model.anchorYears[0]&&y<model.anchorYears.at(-1)!&&!model.anchorYears.includes(y)),scenario_annual_values:range.map(y=>({year:y,delta_m:t.d[model.years.indexOf(y)]})),method_url:'/data/shorelines/scenario/method.md'}};
 })};
}
