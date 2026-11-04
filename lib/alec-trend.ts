export type AlecTrendModel = {
  transect_id:string; series:'L5'|'L8'|'S2'; rate_m_year:number;
  anchor_observation_id:string; step_degrees_per_metre:[number,number];
};
export type AlecTrendCatalogue = {
  schema_version:1; method_id:'alec-anchored-trend-v1'; source_url:string;
  periods:Record<AlecTrendModel['series'],{start:number;end:number}>;
  models:AlecTrendModel[]; limits:string; input_sha256:Record<string,string>;
};
export function validateAlecTrends(input:unknown):AlecTrendCatalogue {
  const data=input as AlecTrendCatalogue;
  if(data?.schema_version!==1||data.method_id!=='alec-anchored-trend-v1'||!Array.isArray(data.models))throw new Error('Modelos de tendencia inválidos');
  const seen=new Set<string>();
  for(const m of data.models){
    const period=data.periods?.[m.series],key=m.transect_id+'|'+m.series;
    if(!m.transect_id||seen.has(key)||!period||!Number.isInteger(period.start)||!Number.isInteger(period.end)||period.start>=period.end||
      !Number.isFinite(m.rate_m_year)||!m.anchor_observation_id||m.step_degrees_per_metre?.length!==2||!m.step_degrees_per_metre.every(Number.isFinite))throw new Error('Tendencia sin periodo, ancla o dirección verificable');
    seen.add(key);
  }
  return data;
}
