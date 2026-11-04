import type { ErosionData, ErosionFeature } from './problems';
import type { LittoralCut, LittoralMeasurement, LittoralRuler, BarMapLabel } from './littoral-series';
import type { AlecTrendCatalogue, AlecTrendModel } from './alec-trend';
const shortLittoralDate = (value: string | null) => value ? new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'sin fecha';

export const EVOLUTION_BASE_YEAR = 1993;
export const UNAVAILABLE_TEXT = 'Información no disponible';
export type EvolutionCatalogue = {
  schema_version: 1;
  baseline_year: 1986;
  baseline_observation_id: string | null;
  baseline_reference_policy?: 'preferred-then-earliest-1986';
  generated_at: string;
  observations: LittoralCut[];
  quality_note: string;
  reviewed_1986_products: number;
};
export type EvolutionIndex = {
  catalogue: EvolutionCatalogue;
  baseline: LittoralCut | null;
  baselineValues: Map<string, LittoralMeasurement>;
  references: Map<string, { cut: LittoralCut; measurement: LittoralMeasurement }>;
  annual: Map<number, LittoralCut>;
  values: Map<string, Map<string, LittoralMeasurement>>;
  annualValues: Map<number, Map<string, { cut: LittoralCut; measurement: LittoralMeasurement }>>;
  referencePolicy: '1986' | 'earliest' | '1993';
  baselineEstimates: Map<string, { measurement: LittoralMeasurement; estimate: EvolutionEstimate }>;
  trendCatalogue: AlecTrendCatalogue | null;
  trendModels: Map<string,AlecTrendModel[]>;
  cutsById:Map<string,LittoralCut>;
  cutTimes:Map<string,number>;
};
export type EvolutionEstimate = { model:AlecTrendModel; anchorCut:LittoralCut; evaluationDate:string; period:string; sourceUrl:string; deltaFromAnchorM:number };
export type EvolutionComparison = {
  id: string;
  year: number;
  status: 'available' | 'estimated' | 'baseline' | 'no_reference' | 'no_observation';
  beforeCut: LittoralCut | null;
  afterCut: LittoralCut | null;
  before: LittoralMeasurement | null;
  after: LittoralMeasurement | null;
  changeM: number | null;
  color: string;
  estimate?: EvolutionEstimate;
  baselineEstimate?: EvolutionEstimate;
  baselineYear?: number;
};
export const EVOLUTION_COLORS = [
  { metres: 10, retreat: '#ff8a80', advance: '#78ce76' },
  { metres: 30, retreat: '#ff6358', advance: '#45ba57' },
  { metres: 60, retreat: '#ef3c35', advance: '#20a448' },
  { metres: Infinity, retreat: '#ca1f2a', advance: '#128438' },
];
const usable = (m: LittoralMeasurement | null | undefined) => !!m?.point && m.value !== null && m.quality !== 'no_data';

export function validateEvolutionCatalogue(input: unknown): EvolutionCatalogue {
  const data = input as EvolutionCatalogue;
  if (data?.schema_version !== 1 || data.baseline_year !== 1986 || !Array.isArray(data.observations)) throw new Error('Catálogo de evolución inválido');
  const ids = new Set<string>();
  for (const cut of data.observations) {
    if (!cut.id || ids.has(cut.id) || !cut.datetime || !Number.isFinite(Date.parse(cut.datetime)) ||
      cut.variable !== 'waterline_position' || cut.unit !== 'm' || !cut.product?.id ||
      !['sentinel', 'landsat'].includes(cut.origin) || !Array.isArray(cut.measurements)) throw new Error('La evolución exige posiciones fechadas, no tasas');
    ids.add(cut.id);
    const measured = new Set<string>();
    for (const m of cut.measurements) {
      if (!m.transect_id || measured.has(m.transect_id) || (m.value !== null && !Number.isFinite(m.value)) ||
        (m.point && (m.point.length !== 2 || !m.point.every(Number.isFinite))) ||
        (m.quality === 'no_data' && (m.value !== null || m.point !== null))) throw new Error('Posición litoral inválida');
      measured.add(m.transect_id);
    }
  }
  if (data.baseline_observation_id) {
    const base = data.observations.find((cut) => cut.id === data.baseline_observation_id);
    if (!base || !base.datetime?.startsWith('1986-')) throw new Error('La referencia debe ser una observación real de 1986');
  }
  return data;
}

export function createEvolutionIndex(data: EvolutionCatalogue, options?: { referencePolicy?:'1986'|'earliest'|'1993'; trends?:AlecTrendCatalogue|null }): EvolutionIndex {
  const referencePolicy=options?.referencePolicy??'1986';
  const annual = new Map<number, LittoralCut>();
  const values = new Map<string, Map<string, LittoralMeasurement>>();
  const annualValues = new Map<number, Map<string, { cut: LittoralCut; measurement: LittoralMeasurement }>>();
  for (const cut of [...data.observations].sort((a, b) => a.datetime!.localeCompare(b.datetime!))) {
    const year = Number(cut.datetime!.slice(0, 4));
    annual.set(year, cut);
    values.set(cut.id, new Map(cut.measurements.map((m) => [m.transect_id, m])));
    const byId = annualValues.get(year) ?? new Map();
    for (const measurement of cut.measurements) if (usable(measurement) || !usable(byId.get(measurement.transect_id)?.measurement)) byId.set(measurement.transect_id, { cut, measurement });
    annualValues.set(year, byId);
  }
  const baseline = data.observations.find((cut) => cut.id === data.baseline_observation_id) ?? null;
  const references = new Map<string, { cut: LittoralCut; measurement: LittoralMeasurement }>();
  for (const measurement of baseline?.measurements ?? []) if (usable(measurement)) references.set(measurement.transect_id, { cut: baseline!, measurement });
  // Preserve every accepted preferred reference; fill only missing axes with
  // another real, reviewed 1986 capture, keeping its exact individual date.
  if (data.baseline_reference_policy === 'preferred-then-earliest-1986') {
    for (const cut of data.observations.filter((cut) => cut.datetime!.startsWith('1986-')).sort((a,b) => a.datetime!.localeCompare(b.datetime!)))
      for (const measurement of cut.measurements) if (!references.has(measurement.transect_id) && usable(measurement)) references.set(measurement.transect_id, { cut, measurement });
  }
  if(referencePolicy==='earliest'){
    references.clear();
    for(const cut of [...data.observations].sort((a,b)=>a.datetime!.localeCompare(b.datetime!)))
      for(const measurement of cut.measurements)if(usable(measurement)&&!references.has(measurement.transect_id))references.set(measurement.transect_id,{cut,measurement});
  }
  if (baseline && referencePolicy==='1986') {
    annual.set(1986, baseline);
    annualValues.set(1986, references);
  }
  const trendModels=new Map<string,AlecTrendModel[]>();
  for(const model of options?.trends?.models??[]){
    const cut=data.observations.find(c=>c.id===model.anchor_observation_id);
    const period=options!.trends!.periods[model.series];
    if(!cut||!usable(values.get(cut.id)?.get(model.transect_id))||Number(cut.datetime!.slice(0,4))<period.start||Number(cut.datetime!.slice(0,4))>period.end)throw new Error('Modelo sin ancla satelital compatible');
    const list=trendModels.get(model.transect_id)??[];list.push(model);trendModels.set(model.transect_id,list);
  }
  for(const list of trendModels.values())list.sort((a,b)=>['S2','L8','L5'].indexOf(a.series)-['S2','L8','L5'].indexOf(b.series));
  const index:EvolutionIndex = { catalogue: data, baseline, references, baselineValues: new Map([...references].map(([id,entry]) => [id,entry.measurement])), baselineEstimates:new Map(), annual, values, annualValues,referencePolicy,trendCatalogue:options?.trends??null,trendModels,cutsById:new Map(data.observations.map(c=>[c.id,c])),cutTimes:new Map(data.observations.map(c=>[c.id,Date.parse(c.datetime!)])) };
  if(referencePolicy==='1993'){
    references.clear();index.baselineValues.clear();
    index.baseline=annual.get(EVOLUTION_BASE_YEAR)??null;
    for(const[id,entry]of annualValues.get(EVOLUTION_BASE_YEAR)??[])if(usable(entry.measurement)){references.set(id,entry);index.baselineValues.set(id,entry.measurement);}
    for(const id of trendModels.keys())if(!references.has(id)){
      const evaluated=evaluateEvolutionTrend(index,id,EVOLUTION_BASE_YEAR);
      if(evaluated){index.baselineEstimates.set(id,evaluated);index.baselineValues.set(id,evaluated.measurement);}
    }
  }
  return index;
}

/** Existing anchored model only: no backward evaluation, no period bridging. */
function evaluateEvolutionTrend(index:EvolutionIndex,id:string,year:number):{measurement:LittoralMeasurement;estimate:EvolutionEstimate}|null {
  if(!index.trendCatalogue)return null;
  const evaluationDate=`${year}-07-01T12:00:00.000Z`,evaluation=Date.parse(evaluationDate);
  for(const model of index.trendModels.get(id)??[]){
    const period=index.trendCatalogue.periods[model.series];
    if(year<period.start||year>period.end)continue;
    const anchorCut=index.cutsById.get(model.anchor_observation_id)!;
    const anchor=index.values.get(anchorCut.id)?.get(id);
    if(!usable(anchor)||evaluation<=index.cutTimes.get(anchorCut.id)!)continue;
    const delta=model.rate_m_year*(evaluation-index.cutTimes.get(anchorCut.id)!)/(365.2425*86400000);
    const value=(anchor!.raw_interpolated_position_m??anchor!.value!)+delta;
    return {measurement:{...anchor!,value,raw_interpolated_position_m:value,point:[anchor!.point![0]+model.step_degrees_per_metre[0]*delta,anchor!.point![1]+model.step_degrees_per_metre[1]*delta],reason:'Posición modelada; no es una observación satelital.'},
      estimate:{model,anchorCut,evaluationDate,period:`${period.start}–${period.end}`,sourceUrl:index.trendCatalogue.source_url,deltaFromAnchorM:delta}};
  }
  return null;
}

function fixed1993Comparison(index:EvolutionIndex,id:string,year:number,cutId?:string|null):EvolutionComparison {
  const empty:EvolutionComparison={id,year,baselineYear:EVOLUTION_BASE_YEAR,status:'no_observation',beforeCut:null,afterCut:null,before:null,after:null,changeM:null,color:'#9ba7a8'};
  if(year<EVOLUTION_BASE_YEAR)return empty;
  const reference=index.references.get(id),modeledBase=index.baselineEstimates.get(id);
  const before=reference?.measurement??modeledBase?.measurement??null;
  const explicitCut=cutId?index.cutsById.get(cutId):null;
  const current=explicitCut&&Number(explicitCut.datetime!.slice(0,4))===year?{cut:explicitCut,measurement:index.values.get(explicitCut.id)?.get(id)??null}:cutId?null:index.annualValues.get(year)?.get(id);
  let after=current?.measurement??null,afterCut=current?.cut??null,estimate:EvolutionEstimate|undefined;
  if(usable(before)&&year===EVOLUTION_BASE_YEAR)return {...empty,status:'baseline',beforeCut:reference?.cut??null,afterCut:reference?.cut??null,before,after:before,color:'#8b9690',...(modeledBase?{baselineEstimate:modeledBase.estimate}:{})};
  if(!usable(after)&&!cutId&&usable(before)){
    const evaluated=evaluateEvolutionTrend(index,id,year);
    if(evaluated){after=evaluated.measurement;afterCut=null;estimate=evaluated.estimate;}
  }
  const status=!usable(after)?'no_observation':!usable(before)?'no_reference':modeledBase||estimate?'estimated':'available';
  const raw=(m:LittoralMeasurement)=>m.raw_interpolated_position_m??m.value!;
  const changeM=status==='estimated'||status==='available'?Math.round((raw(after!)-raw(before!))/10)*10:null;
  const scale=EVOLUTION_COLORS.find(step=>Math.abs(changeM??0)<=step.metres)!;
  const color=changeM===null?'#9ba7a8':changeM===0?'#8b9690':changeM<0?scale.retreat:scale.advance;
  return {...empty,status,beforeCut:reference?.cut??null,afterCut,before,after,changeM,color,...(estimate?{estimate}:{}),...(modeledBase?{baselineEstimate:modeledBase.estimate}:{})};
}

const comparedFrames=new WeakMap<EvolutionIndex,Map<string,Map<string,EvolutionComparison>>>();
function comparisonFrame(index:EvolutionIndex,year:number,cutId?:string|null){
  let frames=comparedFrames.get(index);if(!frames){frames=new Map();comparedFrames.set(index,frames);}
  const key=year+'|'+(cutId??'');let frame=frames.get(key);
  if(!frame){if(frames.size>=4)frames.delete(frames.keys().next().value!);frame=new Map();frames.set(key,frame);}
  return frame;
}
const estimateDates=new Map<number,{text:string;time:number}>();
export function evolutionComparison(index: EvolutionIndex, id: string, year: number, cutId?: string | null): EvolutionComparison {
  const memo=comparisonFrame(index,year,cutId),cached=memo.get(id);if(cached)return cached;
  if(index.referencePolicy==='1993'){const result=fixed1993Comparison(index,id,year,cutId);memo.set(id,result);return result;}
  const explicitCut = cutId ? index.catalogue.observations.find((cut) => cut.id === cutId && Number(cut.datetime!.slice(0, 4)) === year) : null;
  const explicitValue = explicitCut ? index.values.get(explicitCut.id)?.get(id) : null;
  const record = explicitCut ? { cut: explicitCut, measurement: explicitValue ?? null } : index.annualValues.get(year)?.get(id);
  let afterCut = record?.cut ?? null;
  let after = record?.measurement ?? null;
  const reference = index.references.get(id);
  const before = reference?.measurement ?? null;
  const hasBase = usable(before);
  let hasCurrent = usable(after);
  let estimate:EvolutionComparison['estimate'];
  // A real observation always wins. Synthetic endpoints never enter the source catalogue.
  if(!hasCurrent&&!explicitCut&&hasBase&&index.trendCatalogue){
    if(!estimateDates.has(year)){const text=`${year}-07-01T12:00:00.000Z`;estimateDates.set(year,{text,time:Date.parse(text)});}
    const {text:evaluationDate,time:evaluation}=estimateDates.get(year)!;
    for(const model of index.trendModels.get(id)??[]){
      const period=index.trendCatalogue.periods[model.series];
      if(year<period.start||year>period.end)continue;
      const anchorCut=index.cutsById.get(model.anchor_observation_id)!;
      const anchor=index.values.get(anchorCut.id)!.get(id)!;
      if(evaluation<=index.cutTimes.get(anchorCut.id)!||evaluation<=index.cutTimes.get(reference!.cut.id)!)continue;
      const delta=model.rate_m_year*(evaluation-index.cutTimes.get(anchorCut.id)!)/(365.2425*86400000);
      const value=(anchor.raw_interpolated_position_m??anchor.value!)+delta;
      after={...anchor,value,raw_interpolated_position_m:value,point:[anchor.point![0]+model.step_degrees_per_metre[0]*delta,anchor.point![1]+model.step_degrees_per_metre[1]*delta],reason:'Endpoint modelado; no es una observación satelital.'};
      afterCut=null;
      estimate={model,anchorCut,evaluationDate,period:`${period.start}–${period.end}`,sourceUrl:index.trendCatalogue.source_url,deltaFromAnchorM:delta};
      hasCurrent=true;break;
    }
  }
  const firstYear=reference?Number(reference.cut.datetime!.slice(0,4)):1986;
  const isFirst=hasBase&&hasCurrent&&!estimate&&(index.referencePolicy==='1986'?year===1986:!explicitCut&&year===firstYear||afterCut?.id===reference?.cut.id);
  if(isFirst){after=before;afterCut=reference!.cut;}
  const status = !hasCurrent ? 'no_observation' : !hasBase ? 'no_reference' : isFirst ? 'baseline' : estimate?'estimated':'available';
  // Coarser communication precision for an exploratory 30 m Landsat reference.
  // Source positions are retained; this rounding is not a confidence interval.
  const raw = (value: LittoralMeasurement) => typeof value.raw_interpolated_position_m === 'number' ? value.raw_interpolated_position_m : value.value!;
  const changeM = status === 'available'||status==='estimated' ? Math.round((raw(after!) - raw(before!)) / 10) * 10 : null;
  const scale = EVOLUTION_COLORS.find((step) => Math.abs(changeM ?? 0) <= step.metres)!;
  const color = status === 'baseline' || changeM === 0 ? '#8b9690' : changeM === null ? '#9ba7a8' : changeM < 0 ? scale.retreat : scale.advance;
  const result:EvolutionComparison={ id, year, status, beforeCut: reference?.cut ?? null, afterCut, before, after, changeM, color,...(estimate?{estimate}:{}) };memo.set(id,result);return result;
}

// Years without any observation share the same invisible reference geometry.
// The requested year lives in the calendar and explanations, not in fake dated features.
const emptyFrames = new WeakMap<EvolutionIndex, WeakMap<ErosionData, ErosionData>>();
const renderedFrames = new WeakMap<EvolutionIndex, WeakMap<ErosionData, Map<string, ErosionData>>>();
export function evolutionMapData(inventory: ErosionData, index: EvolutionIndex, year: number, cutId?: string | null): ErosionData {
  let inventories = renderedFrames.get(index);
  if (!inventories) { inventories = new WeakMap(); renderedFrames.set(index, inventories); }
  let frames = inventories.get(inventory);
  if (!frames) { frames = new Map(); inventories.set(inventory, frames); }
  const key = `${year}|${cutId ?? ''}`;
  const cached = frames.get(key);
  if (cached) { frames.delete(key); frames.set(key, cached); return cached; }
  const empty = !cutId && !index.annualValues.has(year)&&!index.trendModels.size;
  let byInventory = emptyFrames.get(index);
  if (empty && byInventory?.has(inventory)) return byInventory.get(inventory)!;
  const frame: ErosionData = { type: 'FeatureCollection', features: inventory.features.map((feature) => {
    const comparison = evolutionComparison(index, feature.properties.idPol_Tran, year, cutId);
    return { ...feature,
      geometry: ['available','estimated'].includes(comparison.status) ? { type: 'LineString', coordinates: [comparison.before!.point!, comparison.after!.point!] }
        : comparison.status === 'baseline' ? { type: 'LineString', coordinates: [comparison.before!.point!, comparison.before!.point!] }
        : comparison.status === 'no_reference' ? { type: 'LineString', coordinates: [comparison.after!.point!, comparison.after!.point!] } : feature.geometry,
      properties: { ...feature.properties, evolution_status: comparison.status, evolution_color: comparison.color,
        evolution_year: empty ? null : year, evolution_change_m: comparison.changeM,
        evolution_before_date: comparison.beforeCut?.datetime ?? null, evolution_after_date: comparison.afterCut?.datetime ?? null,
        ...(comparison.baselineYear?{evolution_baseline_year:comparison.baselineYear,evolution_baseline_kind:comparison.baselineEstimate?'estimated':comparison.beforeCut?'observed':'missing',evolution_baseline_evaluation_date:comparison.baselineEstimate?.evaluationDate??null,evolution_baseline_provenance:comparison.baselineEstimate?'project_estimate_assisted_by_chatgpt':comparison.beforeCut?'satellite_position_processed':'unavailable',evolution_comparison_provenance:comparison.status==='estimated'||comparison.baselineEstimate?'project_estimate_assisted_by_chatgpt':comparison.status==='available'?'project_comparison_assisted_by_chatgpt':'not_comparable'}:{}),
        ...(comparison.estimate?{evolution_estimated_year:year,evolution_model_period:comparison.estimate.period,evolution_model_rate:comparison.estimate.model.rate_m_year}:{}), },
    };
  }) };
  if (empty) {
    if (!byInventory) { byInventory = new WeakMap(); emptyFrames.set(index, byInventory); }
    byInventory.set(inventory, frame);
  }
  if (frames.size >= 8) frames.delete(frames.keys().next().value!);
  frames.set(key, frame);
  return frame;
}

export function evolutionMessage(comparison: EvolutionComparison) {
  if(comparison.baselineYear===EVOLUTION_BASE_YEAR){
    if(comparison.year<EVOLUTION_BASE_YEAR)return 'Comparación omitida: la base fija es 1993 y no se compara un año anterior con una referencia futura.';
    if(comparison.status==='no_reference')return `Falta una base medida o estimada compatible en 1993 para este sitio. La posición observada el ${shortLittoralDate(comparison.afterCut!.datetime)} se conserva como dato, sin cifra ni barra de cambio desde 1993.`;
    if(comparison.status==='no_observation')return `${comparison.before?'Hay una base fija de 1993, pero falta':'Falta una base fija utilizable de 1993 y'} una posición observada o una estimación compatible de ${comparison.year}. No se calcula desplazamiento; la ausencia de información no demuestra estabilidad.`;
    if(comparison.status==='baseline')return comparison.baselineEstimate?'Estimación del proyecto · asistida por ChatGPT. Base fija de 1993 · estimada (≈) con la tendencia L5 y una posición real anterior. La evaluación matemática al 1 de julio de 1993 no es una captura de 1993. Este punto de partida no demuestra ausencia de erosión.':`Base fija de 1993 · observada el ${shortLittoralDate(comparison.beforeCut!.datetime)}. Es el punto de partida, sin una cifra de erosión para el año base.`;
    const base=comparison.baselineEstimate?'base de 1993 estimada (≈), sin una observación de 1993':`base observada el ${shortLittoralDate(comparison.beforeCut!.datetime)}`;
    const endpoint=comparison.estimate?`extremo estimado para ${comparison.year}; su fecha matemática no es una captura`:`posición observada el ${shortLittoralDate(comparison.afterCut!.datetime)}`;
    const movement=comparison.changeM===0?'≈ 0 m de cambio redondeado; no demuestra estabilidad':`≈ ${Math.abs(comparison.changeM!).toLocaleString('es-MX')} m ${comparison.changeM!<0?'hacia tierra':'hacia el mar'}`;
    return `${comparison.status==='estimated'?'Estimación del proyecto · asistida por ChatGPT. Cambio estimado':'Comparación del proyecto · asistida por ChatGPT. Cambio observado'} desde la ${base} hasta la ${endpoint}: ${movement}. ${comparison.baselineEstimate?'La base modelada hace que toda la comparación sea estimada, aunque el extremo posterior esté observado. ':''}Sin corrección de marea y oleaje; no confirma pérdida de arena.`;
  }
  if(comparison.status==='estimated')return `Para ${comparison.year}, se estima ≈ ${Math.abs(comparison.changeM!).toLocaleString('es-MX')} m ${comparison.changeM!<0?'hacia tierra':comparison.changeM!>0?'hacia el mar':'de cambio redondeado'} desde el ${shortLittoralDate(comparison.beforeCut!.datetime)}. Usa la tendencia de Alec de ${comparison.estimate!.period}, anclada a una posición real. No es una medición de ${comparison.year} ni confirma pérdida de arena.`;
  if (comparison.status === 'no_reference') return `El punto gris marca dónde se detectó el agua el ${shortLittoralDate(comparison.afterCut!.datetime)}. Falta una posición de referencia comparable; no se dibuja una barra de pérdida o avance.`;
  if (comparison.status === 'no_observation') return `No hay una posición utilizable de ${comparison.year} ni una estimación con ancla y periodo compatibles en este sitio. La ausencia de información no significa que la playa esté sana.`;
  if (comparison.status === 'baseline') return `Aquí se detectó el borde del agua el ${shortLittoralDate(comparison.beforeCut!.datetime)}. Es el punto de partida; no indica una playa sana ni ausencia de erosión.`;
  const dates = `${shortLittoralDate(comparison.beforeCut!.datetime)} → ${shortLittoralDate(comparison.afterCut!.datetime)}`;
  const movement = comparison.changeM === 0 ? 'la diferencia redondeada es ≈ 0 m; no demuestra estabilidad' : `el agua aparece ≈ ${Math.abs(comparison.changeM!).toLocaleString('es-MX')} m ${comparison.changeM! < 0 ? 'hacia tierra' : 'hacia el mar'}`;
  return `${dates}: ${movement}. Resultado preliminar; marea, oleaje y diferencias entre sensores pueden influir.`;
}

/** Spread missing-data labels over real authored axes without inventing coverage polygons. */
export function unavailableLabelPositions(features: ErosionFeature[], project: (point: number[]) => [number, number], spacing = 180, maximum = 10) {
  const labels: { id: string; point: [number, number]; screen: [number, number] }[] = [];
  const clearance = Math.min(90, spacing / 2);
  const measured = new Map<string, [number, number][]>();
  const midpoint = (coordinates: number[][]) => [(coordinates[0][0] + coordinates.at(-1)![0]) / 2, (coordinates[0][1] + coordinates.at(-1)![1]) / 2] as [number, number];
  for (const feature of features) {
    if (!['available', 'estimated', 'baseline', 'no_reference'].includes(String(feature.properties.evolution_status))) continue;
    const screen = project(midpoint(feature.geometry.coordinates));
    const key = `${Math.floor(screen[0] / clearance)},${Math.floor(screen[1] / clearance)}`;
    const points = measured.get(key) ?? []; points.push(screen); measured.set(key, points);
  }
  for (const feature of features) {
    if (feature.properties.evolution_status !== 'no_observation') continue;
    const point = midpoint(feature.geometry.coordinates);
    const screen = project(point);
    const cell = screen.map((coordinate) => Math.floor(coordinate / clearance));
    let nearMeasured = false;
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) {
      if (measured.get(`${cell[0] + x},${cell[1] + y}`)?.some((point) => Math.hypot(point[0] - screen[0], point[1] - screen[1]) < clearance)) nearMeasured = true;
    }
    if (nearMeasured) continue;
    if (labels.some((label) => Math.hypot(screen[0] - label.screen[0], screen[1] - label.screen[1]) < spacing)) continue;
    labels.push({ id: feature.properties.idPol_Tran, point, screen });
    if (labels.length === maximum) break;
  }
  return labels;
}

export function evolutionRuler(comparison: EvolutionComparison, origin: [number, number]): LittoralRuler | null {
  if (!['available', 'baseline'].includes(comparison.status)||!comparison.beforeCut||!comparison.afterCut||comparison.baselineEstimate) return null;
  const endpoint = (m: LittoralMeasurement, cut: LittoralCut) => ({ point: m.point!, positionM: m.value!, date: cut.datetime!, sourceUrl: cut.product!.metadata_url, productId: cut.product!.id });
  return { id: comparison.id, origin, current: endpoint(comparison.after!, comparison.afterCut!), baseline: endpoint(comparison.before!, comparison.beforeCut!), changeM: comparison.changeM, color: comparison.color };
}

export function evolutionBarLabels(comparison: EvolutionComparison, referencePoint?: [number, number]): BarMapLabel[] {
  if(comparison.baselineYear===EVOLUTION_BASE_YEAR)return fixed1993BarLabels(comparison,referencePoint);
  if(comparison.status==='estimated'){
    const text=`Estimado · ≈ ${Math.abs(comparison.changeM!).toLocaleString('es-MX')} m`,model=comparison.estimate!;
    const help:BarMapLabel['explanation']={title:text,points:[{label:'',text:evolutionMessage(comparison)}],sourceLabel:'Alec · tendencia publicada',sourceUrl:model.sourceUrl,baselineSourceUrl:comparison.beforeCut!.source_url,
      technical:`${comparison.id}. Método alec-anchored-trend-v1. Ancla real: ${model.anchorCut.product!.id} (${model.anchorCut.datetime}); tasa ${model.model.rate_m_year} m/año de ${model.period}. Evaluación matemática al 1 de julio de ${comparison.year}; no es captura. Referencia de esta barra: ${comparison.beforeCut!.product!.id}. No se extrapola fuera del periodo ni se suman tasas. Falta validar compatibilidad de métodos, marea, oleaje y registro. Colores: desplazamiento estimado, no salud ecológica.`};
    return [{kind:'change',id:comparison.id,point:comparison.after!.point!,text,color:comparison.color,explanation:help},
      {kind:'current',id:comparison.id,point:comparison.after!.point!,text:`Estimado · ${comparison.year}`,color:comparison.color,explanation:help},
      {kind:'baseline',id:comparison.id,point:comparison.before!.point!,text:'Referencia · '+shortLittoralDate(comparison.beforeCut!.datetime),explanation:{...help,title:'Referencia medida',sourceUrl:comparison.beforeCut!.source_url,points:[{label:'',text:`Aquí se detectó el agua el ${shortLittoralDate(comparison.beforeCut!.datetime)}. El otro extremo es una estimación para ${comparison.year}.`}]}}];
  }
  if (comparison.status === 'no_reference' && comparison.after?.point) return [{ kind: 'current', id: comparison.id, point: comparison.after.point,
    text: 'Agua · ' + shortLittoralDate(comparison.afterCut!.datetime), color: '#9ba7a8', explanation: {
      title: 'Agua detectada · ' + shortLittoralDate(comparison.afterCut!.datetime), points: [{ label: '', text: evolutionMessage(comparison) }],
      sourceLabel: 'Producto satelital', sourceUrl: comparison.afterCut!.source_url,
      technical: `${comparison.id}. Posición del agua observada; falta una posición anterior utilizable como referencia. No se calcula desplazamiento sin ella. La fecha del fondo es independiente.`,
    } }];
  if (!comparison.after?.point || !['available', 'baseline'].includes(comparison.status)) {
    const point = comparison.before?.point ?? comparison.after?.point ?? referencePoint;
    if (!point) return [];
    return [{ kind: 'change', id: comparison.id, point, text: UNAVAILABLE_TEXT, color: '#9ba7a8', explanation: {
      title: UNAVAILABLE_TEXT, points: [{ label: '', text: evolutionMessage(comparison) }],
      sourceLabel: 'Procedimiento y límites', sourceUrl: '/data/littoral/evolution-method.md',
      technical: `${comparison.id}. Año elegido: ${comparison.year}. Falta una referencia aceptada o una posición del año elegido. Tampoco hay una estimación con ancla y periodo compatibles. No hay segmento ni cifra de desplazamiento. El rótulo se ancla a una posición disponible o al eje original para poder consultar el sitio; no representa una costa actual inventada.`,
    } }];
  }
  const first = comparison.status === 'baseline';
  const dates = first ? 'Inicio · '+comparison.beforeCut!.datetime!.slice(0,4) : `≈ ${Math.abs(comparison.changeM!).toLocaleString('es-MX')} m`;
  const technical = `${comparison.id}. Referencia fija: ${comparison.beforeCut!.product!.id}; observación: ${comparison.afterCut!.product!.id}. Ejes originales de Alec conservados. La línea une las posiciones guardadas, no una extrapolación de LRR. Landsat: 30 m; Sentinel: 10 m. Cambio comunicado redondeado a 10 m. Sin correcciones de marea, oleaje ni validación independiente de registro u homologación entre sensores. Los colores expresan desplazamiento aparente, no salud ecológica ni deterioro certificado. La foto tiene su propia fecha.`;
  const help: BarMapLabel['explanation'] = { title: dates, points: [{ label: '', text: evolutionMessage(comparison) }], sourceLabel: 'Producto satelital', sourceUrl: comparison.afterCut!.source_url, baselineSourceUrl: comparison.beforeCut!.source_url, technical, cutId: comparison.afterCut!.id };
  const labels: BarMapLabel[] = [{ kind: 'change', id: comparison.id, point: comparison.after.point, text: dates, color: comparison.color, explanation: help },
    { kind: 'current', id: comparison.id, point: comparison.after.point, text: (first ? 'Inicio · ' : 'Después · ') + shortLittoralDate(comparison.afterCut!.datetime), color: comparison.color, explanation: { ...help, title: (first ? 'Inicio · ' : 'Después · ') + shortLittoralDate(comparison.afterCut!.datetime) } }];
  if (!first && comparison.before!.point!.some((coordinate, i) => Math.abs(coordinate - comparison.after!.point![i]) > 1e-12)) labels.push({
    kind: 'baseline', id: comparison.id, point: comparison.before!.point!, text: 'Antes · ' + shortLittoralDate(comparison.beforeCut!.datetime),
    explanation: { ...help, title: 'Antes · ' + shortLittoralDate(comparison.beforeCut!.datetime), sourceUrl: comparison.beforeCut!.source_url,
      points: [{ label: '', text: `Esta es la posición del agua medida el ${shortLittoralDate(comparison.beforeCut!.datetime)}. La barra llega desde aquí hasta la posición de la fecha elegida.` }] },
  });
  return labels;
}

function fixed1993BarLabels(c:EvolutionComparison,referencePoint?:[number,number]):BarMapLabel[]{
  const baseModel=c.baselineEstimate,endpointModel=c.estimate;
  const baseUrl=baseModel?.sourceUrl??c.beforeCut?.source_url;
  const sourceUrl=c.afterCut?.source_url??endpointModel?.sourceUrl??baseUrl??'/data/littoral/fixed-1993-method.md';
  const baseText=baseModel?'Base 1993 · estimada (≈)':c.beforeCut?'Base 1993 · '+shortLittoralDate(c.beforeCut.datetime):'Sin base 1993';
  const describe=(e:EvolutionEstimate)=>`tendencia ${e.model.series}, ${e.model.rate_m_year} m/año de ${e.period}; ancla observada ${e.anchorCut.product!.id} (${e.anchorCut.datetime}); evaluación matemática ${e.evaluationDate}, no captura`;
  const technical=`${c.id}. Base fija 1993. ${baseModel?'Base modelada: '+describe(baseModel):c.beforeCut?'Base observada: '+c.beforeCut.product!.id+' ('+c.beforeCut.datetime+')':'No hay base de 1993 compatible'}. ${endpointModel?'Extremo modelado: '+describe(endpointModel):c.afterCut?'Extremo observado: '+c.afterCut.product!.id+' ('+c.afterCut.datetime+')':'Sin extremo anual compatible'}. Las tasas originales proceden de la investigación publicada de Alec y colaboradores; la base y la comparación son cálculos derivados del proyecto con asistencia de ChatGPT, no resultados anuales originales del artículo. Si cualquier extremo es modelado, todo el cambio es estimado. Sin evaluación antes del ancla ni fuera del periodo publicado; no se suman tasas. Cambio comunicado redondeado a 10 m; sin correcciones de marea y oleaje ni homologación de métodos validada. Colores: desplazamiento aparente, no salud ecológica.`;
  const help:BarMapLabel['explanation']={title:baseText,points:[{label:'',text:evolutionMessage(c)}],sourceLabel:c.status==='estimated'||baseModel?'Estimación del proyecto · asistida por ChatGPT':'Posición satelital procesada',sourceUrl,baselineSourceUrl:baseUrl,technical,...(c.afterCut?{cutId:c.afterCut.id}:{})};
  if(c.status==='baseline'&&c.before?.point)return[{kind:'baseline',id:c.id,point:c.before.point,text:baseText,color:c.color,explanation:{...help,title:baseText}}];
  if(c.status==='no_reference'&&c.after?.point)return[{kind:'current',id:c.id,point:c.after.point,text:'Sin base de 1993 · Agua '+shortLittoralDate(c.afterCut!.datetime),color:c.color,explanation:help}];
  if(!['available','estimated'].includes(c.status)||!c.before?.point||!c.after?.point){
    const point=c.before?.point??referencePoint;if(!point)return[];
    return[{kind:'change',id:c.id,point,text:c.year<1993?'Sin comparación antes de 1993':!c.before?'Sin base de 1993':UNAVAILABLE_TEXT,color:c.color,explanation:help}];
  }
  const changeText=(c.status==='estimated'?'Estimado del proyecto · ':'')+'≈ '+Math.abs(c.changeM!).toLocaleString('es-MX')+' m desde 1993';
  const currentText=endpointModel?'Extremo estimado · '+c.year:'Agua observada · '+shortLittoralDate(c.afterCut!.datetime);
  return[{kind:'change',id:c.id,point:c.after.point,text:changeText,color:c.color,explanation:{...help,title:changeText}},
    {kind:'current',id:c.id,point:c.after.point,text:currentText,color:c.color,explanation:{...help,title:currentText,...(c.afterCut?{sourceLabel:'Posición satelital procesada',sourceUrl:c.afterCut.source_url}:{})}},
    {kind:'baseline',id:c.id,point:c.before.point,text:baseText,explanation:{...help,title:baseText,sourceUrl:baseUrl??sourceUrl}}];
}
