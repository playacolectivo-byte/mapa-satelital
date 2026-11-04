import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { Bounds } from './view';
import type { ExplanationPoints } from './map-explanations';
import type { TransectPair } from './transect-pairs';
import type { BarFootprint } from './transect-pairs';

export type LittoralMeasurement = {
  transect_id: string;
  value: number | null;
  change_m: number | null;
  point: [number, number] | null;
  quality: 'published' | 'preliminary' | 'no_data';
  reason?: string;
  category?: string;
  screening_tolerance_m?: number;
  raw_interpolated_position_m?: number;
  native_resolution_m?: number;
};
export type LittoralCut = {
  id: string;
  origin: 'alec' | 'sentinel' | 'landsat' | 'gap';
  label: string;
  start: string;
  end: string;
  datetime: string | null;
  period_label: string;
  variable: 'linear_regression_rate' | 'waterline_position' | null;
  unit: 'm/year' | 'm' | null;
  product: null | { id: string; datetime: string; metadata_url: string; tile?: string; orbit?: string | number; [key: string]: unknown };
  baseline_observation_id: string | null;
  baseline_date: string | null;
  measurements: LittoralMeasurement[];
  quality_note: string;
  source_url: string;
  method_id: string;
};
export type LittoralSeries = {
  schema_version: 1;
  generated_at: string;
  pilot: {
    id: string;
    name: string;
    bounds: Bounds;
    analysis_bbox?: Bounds;
    analysis_crs?: string;
    transects: FeatureCollection<LineString, { idPol_Tran: string; [key: string]: unknown }>;
  };
  cuts: LittoralCut[];
  methods: { id: string; name: string; description: string; limitations: string[] | string }[];
  summary?: Record<string, unknown>;
};
export type LittoralFeature = Feature<LineString, { transect_id: string; color: string; no_data: boolean }>;
export type LittoralMapData = FeatureCollection<LineString, LittoralFeature['properties']>;
export type LittoralMapState = {
  data: LittoralMapData;
  axes: LittoralMapData;
  labels: BarMapLabel[];
  points: FeatureCollection<Point, { transect_id: string; color: string; kind: 'current' | 'baseline' }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
};
export type LittoralRuler = {
  id: string;
  origin: [number, number];
  current: { point: [number, number]; positionM: number; date: string; sourceUrl?: string; productId?: string } | null;
  baseline: { point: [number, number]; positionM: number; date: string; sourceUrl?: string; productId?: string } | null;
  changeM: number | null;
  color: string;
};
export type BarMapLabel = {
  kind: 'front' | 'origin' | 'current' | 'baseline' | 'change'; id: string; point: [number, number]; text: string; detail?: string; change?: string; color?: string;
  explanation: { title: string; points: ExplanationPoints; sourceLabel?: string; sourceUrl?: string; technical: string; cutId?: string; baselineSourceUrl?: string };
};

const mapMetres = (value: number) => '≈ ' + value.toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' m';

/** Fixed display bins in metres, shared by every Sentinel date; not erosion or ecosystem-health classes. */
export const WATER_CHANGE_SCALE = [
  { metres: 5, retreat: '#ff8a80', advance: '#78ce76' },
  { metres: 10, retreat: '#ff6358', advance: '#45ba57' },
  { metres: 15, retreat: '#ef3c35', advance: '#20a448' },
  { metres: 20, retreat: '#ca1f2a', advance: '#128438' },
] as const;
export const WATER_CHANGE_NEUTRAL = '#8b9690';

function changeMapLabel(ruler: LittoralRuler, cut?: LittoralCut | null): BarMapLabel | null {
  if (!ruler.current) return null;
  const delta = ruler.changeM;
  const text = delta === null ? (ruler.baseline ? 'Base' : 'Sin comparación') : mapMetres(Math.abs(delta));
  const direction = delta === null ? (ruler.baseline ? 'Fecha de referencia' : 'Falta la referencia') : delta === 0 ? 'Cambio redondeado · ≈ 0 m' : `${text} ${delta < 0 ? 'hacia tierra' : 'hacia el mar'}`;
  const dates = ruler.baseline ? `${shortLittoralDate(ruler.baseline.date)} → ${shortLittoralDate(ruler.current.date)}` : shortLittoralDate(ruler.current.date);
  const point = ruler.baseline && delta !== null && delta !== 0 ? ruler.current.point.map((value, i) => (value + ruler.baseline!.point[i]) / 2) as [number, number] : ruler.current.point;
  const message = delta === null ? (ruler.baseline ? 'El agua de esta fecha es la referencia para comparar las siguientes.' : 'Hay una posición del agua, pero falta el punto de referencia para comparar esta barra.') : delta === 0 ? `${dates}: la diferencia redondeada es ≈ 0 m; eso no demuestra que la playa esté estable.` : `${dates}: el borde del agua se movió ${text} ${delta < 0 ? 'hacia tierra' : 'hacia el mar'}. La marea y las olas también pueden influir.`;
  return { kind: 'change', id: ruler.id, point, text, color: ruler.color, explanation: {
    title: direction, points: [{ label: '', text: message }], sourceLabel: 'Producto Sentinel-2', sourceUrl: ruler.current.sourceUrl, cutId: cut?.id,
    baselineSourceUrl: ruler.baseline?.sourceUrl,
    technical: `${ruler.id}. ${ruler.current.productId ?? ''}. Comparación con ${ruler.baseline?.productId ?? 'la primera observación'}. Método ${cut?.method_id ?? 's2-c1-ndwi-water-edge-v2'}. La línea une las coordenadas guardadas del agua; el valor comunicado es la diferencia entre posiciones redondeadas a 5 m. El color usa una escala visual fija de 5, 10, 15 y 20 m o más: rojo hacia tierra, verde hacia el mar, mayor intensidad para mayor desplazamiento. No es una clasificación de salud ecológica. Resolución nativa de 10 m. Un cero redondeado se muestra como punto, sin inventar una longitud. Marea, oleaje y registro independiente pendientes: no confirma pérdida o ganancia de arena. La foto de fondo tiene su propia fecha.`,
  } };
}

export function barMapLabels(footprint: BarFootprint, ruler: LittoralRuler | null, cut?: LittoralCut | null): BarMapLabel[] {
  if (!ruler) {
    if (cut?.origin !== 'alec') return [];
    const value = littoralMeasurement(cut, footprint.id);
    const title = value?.value === null || !value ? 'Sin dato' : `${value.value < 0 ? 'Retroceso' : value.value > 0 ? 'Avance' : 'Cambio'} medio · ${Math.abs(value.value).toLocaleString('es-MX', { maximumFractionDigits: 2 })} m/año`;
    const point = footprint.feature.geometry.coordinates.reduce((sum, position) => [sum[0] + position[0] / footprint.feature.geometry.coordinates.length, sum[1] + position[1] / footprint.feature.geometry.coordinates.length], [0, 0]) as [number, number];
    return [{ kind: 'change', id: footprint.id, point, text: title, detail: cut.period_label, explanation: {
      title, points: [{ label: '', text: `${cut.period_label} · Alec y colaboradores. Promedio en metros por año; el cambio pudo variar cada año. El largo de la línea no representa playa perdida.` }],
      sourceLabel: 'Estudio de Alec y colaboradores', sourceUrl: cut.source_url, cutId: cut.id,
      technical: `${footprint.id}. Tasa LRR publicada para ${cut.period_label}, en m/año, no posición anual del agua. Eje original de ${mapMetres(footprint.axisLengthM)} conservado. Separación gráfica asignada entre vecinas: ${footprint.frontM === null ? 'sin asignar' : mapMetres(footprint.frontM)}; no es extensión científica del dato ni límite de celda o predio.`,
    } }];
  }
  if (!ruler.current) return [];
  const change = changeMapLabel(ruler, cut)!;
  const source = { sourceLabel: 'Producto Sentinel-2', sourceUrl: ruler.current.sourceUrl ?? cut?.source_url, cutId: cut?.id };
  const reference = ruler.baseline ? shortLittoralDate(ruler.baseline.date) : 'la referencia';
  const comparison = ruler.changeM === null ? (ruler.baseline ? 'Esta fecha es la referencia para las siguientes.' : 'Falta una referencia para comparar.') : ruler.changeM === 0 ? `Frente al ${reference}, la diferencia redondeada es ≈ 0 m; no prueba estabilidad.` : `Frente al ${reference}, el agua aparece ${change.explanation.title.toLowerCase()}. La marea y las olas también influyen.`;
  const labels: BarMapLabel[] = [change, {
    kind: 'current', id: ruler.id, point: ruler.current.point,
    text: (ruler.changeM === null && ruler.baseline ? 'Referencia · ' : 'Después · ') + shortLittoralDate(ruler.current.date),
    detail: ruler.changeM === null ? (ruler.baseline ? 'Primera observación' : 'Sin comparación') : change.explanation.title,
    color: ruler.color, explanation: {
      title: (ruler.changeM === null && ruler.baseline ? 'Referencia · ' : 'Después · ') + shortLittoralDate(ruler.current.date),
      points: [{ label: '', text: comparison }], ...source, baselineSourceUrl: ruler.baseline?.sourceUrl,
      technical: `${change.explanation.technical} Posición guardada desde el origen fijo del eje: ${mapMetres(ruler.current.positionM)}. Origen original: ${ruler.origin[0].toFixed(7)}, ${ruler.origin[1].toFixed(7)}. La cantidad de decimales no indica exactitud de campo.`,
    },
  }];
  if (ruler.baseline && ruler.changeM !== null && ruler.changeM !== 0) labels.push({
    kind: 'baseline', id: ruler.id, point: ruler.baseline.point,
    text: 'Antes · ' + shortLittoralDate(ruler.baseline.date), explanation: {
      title: 'Antes · ' + shortLittoralDate(ruler.baseline.date),
      points: [{ label: '', text: 'Aquí se detectó el agua en esta fecha. La barra parte de este punto y llega a la posición de la fecha elegida.' }],
      ...source, sourceUrl: ruler.baseline.sourceUrl,
      technical: `${ruler.id}. Referencia propia: ${ruler.baseline.productId ?? ''}. Posición desde el origen fijo: ${mapMetres(ruler.baseline.positionM)}. Método s2-c1-ndwi-water-edge-v2, resolución de 10 m y redondeo a 5 m. No es una posición histórica de Alec. Marea, oleaje y registro independiente pendientes. La fotografía de fondo tiene su propia fecha.`,
    },
  });
  return labels;
}

export function littoralRuler(series: LittoralSeries, cut: LittoralCut, footprint: Pick<BarFootprint, 'id' | 'origin'>): LittoralRuler | null {
  if (cut.origin !== 'sentinel') return null;
  const value = littoralMeasurement(cut, footprint.id);
  const present = value && value.value !== null && value.quality !== 'no_data' && value.point;
  const baselineCut = cut.baseline_observation_id ? series.cuts.find((entry) => entry.id === cut.baseline_observation_id) : null;
  const baseline = baselineCut ? littoralMeasurement(baselineCut, footprint.id) : null;
  const hasBaseline = present && baseline && baseline.value !== null && baseline.quality !== 'no_data' && baseline.point && baselineCut?.datetime;
  return {
    id: footprint.id, origin: footprint.origin,
    current: present ? { point: value.point!, positionM: value.value!, date: cut.datetime!, sourceUrl: cut.product?.metadata_url ?? cut.source_url, productId: cut.product?.id } : null,
    baseline: hasBaseline ? { point: baseline.point!, positionM: baseline.value!, date: baselineCut.datetime!, sourceUrl: baselineCut.product?.metadata_url ?? baselineCut.source_url, productId: baselineCut.product?.id } : null,
    changeM: hasBaseline ? value!.change_m : null,
    color: littoralColor(cut, present ? value : null),
  };
}

/** Reject partial or mixed-unit payloads before any published values reach the map. */
export function validateLittoralSeries(input: unknown): LittoralSeries {
  const series = input as LittoralSeries;
  if (series?.schema_version !== 1 || !series.pilot?.id || !Array.isArray(series.cuts) || !series.cuts.length || !Array.isArray(series.methods)) throw new Error('Serie litoral inválida');
  const features = series.pilot.transects?.features;
  if (!Array.isArray(features) || !features.length || !series.pilot.bounds?.every(Number.isFinite)) throw new Error('Piloto sin referencia espacial');
  const ids = new Set<string>();
  for (const feature of features) {
    const id = feature.properties?.idPol_Tran;
    if (!id || ids.has(id) || feature.geometry?.type !== 'LineString' || feature.geometry.coordinates.length < 2 || !feature.geometry.coordinates.every((p) => p.length >= 2 && p.every(Number.isFinite))) throw new Error('Transectos inválidos o repetidos');
    ids.add(id);
  }
  const cuts = new Set<string>();
  const methods = new Set(series.methods.map((method) => method.id));
  for (const cut of series.cuts) {
    if (!cut.id || cuts.has(cut.id) || !methods.has(cut.method_id) || !['alec', 'sentinel', 'landsat', 'gap'].includes(cut.origin) || !Array.isArray(cut.measurements) || typeof cut.quality_note !== 'string') throw new Error('Corte sin método o repetido');
    cuts.add(cut.id);
    if (cut.origin === 'alec' && (cut.unit !== 'm/year' || cut.variable !== 'linear_regression_rate' || cut.datetime !== null)) throw new Error('Una tasa histórica no es una observación anual');
    if (['sentinel', 'landsat'].includes(cut.origin) && (cut.unit !== 'm' || cut.variable !== 'waterline_position' || !cut.datetime || !Number.isFinite(Date.parse(cut.datetime)) || !cut.product?.id)) throw new Error('Observación satelital sin fecha, producto o unidad');
    const measured = new Set<string>();
    for (const value of cut.measurements) {
      if (!ids.has(value.transect_id) || measured.has(value.transect_id)) throw new Error('Medición repetida o sin transecto');
      measured.add(value.transect_id);
      if (!['published', 'preliminary', 'no_data'].includes(value.quality)) throw new Error('Calidad no especificada');
      if ((value.value !== null && !Number.isFinite(value.value)) || (value.change_m !== null && !Number.isFinite(value.change_m))) throw new Error('Medición no finita');
      if (value.quality === 'no_data' && (value.value !== null || value.change_m !== null)) throw new Error('Un vacío de datos no es cero');
      if (value.point !== null && (value.point.length !== 2 || !value.point.every(Number.isFinite))) throw new Error('Posición inválida');
    }
  }
  for (const cut of series.cuts) if (cut.baseline_observation_id && !cuts.has(cut.baseline_observation_id)) throw new Error('Referencia reciente inexistente');
  return series;
}

export function littoralCut(series: LittoralSeries, id: string | null): LittoralCut {
  return series.cuts.find((cut) => cut.id === id) ?? series.cuts.at(-1)!;
}

export function littoralYearBounds(series: LittoralSeries, currentYear = new Date().getUTCFullYear()) {
  return {
    firstYear: Math.min(...series.cuts.map((cut) => Number(cut.start.slice(0, 4)))),
    lastYear: Math.max(currentYear, ...series.cuts.map((cut) => Number(cut.end.slice(0, 4)))),
  };
}

/** Annual navigation selects real observations or labelled interval references.
 * It never interpolates a measurement or turns a historical rate into a position.
 */
export function littoralCutForYear(series: LittoralSeries, year: number): LittoralCut {
  const observation = series.cuts.filter((cut) => cut.origin === 'sentinel' && Number(cut.datetime?.slice(0, 4)) === year)
    .sort((a, b) => a.datetime!.localeCompare(b.datetime!)).at(-1);
  if (observation) return observation;
  const historical = series.cuts.filter((cut) => cut.origin === 'alec' && Number(cut.start.slice(0, 4)) <= year && Number(cut.end.slice(0, 4)) >= year)
    .sort((a, b) => b.start.localeCompare(a.start))[0];
  if (historical) return historical;
  return {
    id: `gap-year-${year}`, origin: 'gap', label: `${year} · sin mediciones`, start: `${year}-01-01`, end: `${year}-12-31`,
    datetime: null, period_label: String(year), variable: null, unit: null, product: null,
    baseline_observation_id: null, baseline_date: null, measurements: [],
    quality_note: 'No hay una medición recibida para este año. La falta de datos no significa ausencia de erosión.',
    source_url: '/data/littoral/pilot-series.json', method_id: 'no-observation',
  };
}
export function littoralMeasurement(cut: LittoralCut, transectId: string | null) {
  return cut.measurements.find((value) => value.transect_id === transectId) ?? null;
}
export function littoralColor(cut: LittoralCut, measurement: LittoralMeasurement | null) {
  if (cut.origin === 'gap' || !measurement || measurement.value === null || measurement.quality === 'no_data') return '#9ba7a8';
  if (cut.origin === 'alec') {
    const colors: Record<string, string> = { 'Erosión Alta': '#f46c55', 'Erosión Baja': '#f4bd65', Estable: '#a9bdc0', 'Acreción Alta': '#4fc4ad', 'Acreción Baja': '#4fc4ad' };
    return measurement.category ? (colors[measurement.category] ?? '#9ba7a8') : measurement.value < 0 ? '#f46c55' : measurement.value > 0 ? '#4fc4ad' : '#a9bdc0';
  }
  if (measurement.change_m === null || measurement.change_m === 0) return WATER_CHANGE_NEUTRAL;
  const shade = WATER_CHANGE_SCALE.find((step) => Math.abs(measurement.change_m!) <= step.metres) ?? WATER_CHANGE_SCALE.at(-1)!;
  return measurement.change_m < 0 ? shade.retreat : shade.advance;
}
export function littoralAxisData(series: LittoralSeries, cut: LittoralCut): LittoralMapData {
  const values = new Map(cut.measurements.map((measurement) => [measurement.transect_id, measurement]));
  return { type: 'FeatureCollection', features: series.pilot.transects.features.map((feature) => {
    const id = feature.properties.idPol_Tran;
    const measurement = values.get(id) ?? null;
    return { type: 'Feature', id, geometry: feature.geometry, properties: { transect_id: id, color: littoralColor(cut, measurement), no_data: cut.origin === 'gap' || !measurement || measurement.value === null || measurement.quality === 'no_data' } };
  }) };
}
/** Display derivative only. Original scientific axes and values are never rewritten. */
export function littoralMapData(series: LittoralSeries, cut: LittoralCut): LittoralMapData {
  if (cut.origin !== 'sentinel') return littoralAxisData(series, cut);
  const reference = series.cuts.find((entry) => entry.id === cut.baseline_observation_id);
  return { type: 'FeatureCollection', features: cut.measurements.flatMap((value): LittoralFeature[] => {
    const baseline = reference && littoralMeasurement(reference, value.transect_id);
    if (value.value === null || value.quality === 'no_data' || !value.point || value.change_m === null || value.change_m === 0 || !baseline?.point || baseline.value === null || baseline.quality === 'no_data') return [];
    return [{ type: 'Feature', id: value.transect_id, geometry: { type: 'LineString', coordinates: [baseline.point, value.point] }, properties: { transect_id: value.transect_id, color: littoralColor(cut, value), no_data: false } }];
  }) };
}
export function littoralChangeLabels(series: LittoralSeries, cut: LittoralCut): BarMapLabel[] {
  if (cut.origin !== 'sentinel') return [];
  return series.pilot.transects.features.flatMap((feature) => {
    const origin = [...feature.geometry.coordinates].sort((a, b) => a[1] - b[1])[0] as [number, number];
    const ruler = littoralRuler(series, cut, { id: feature.properties.idPol_Tran, origin });
    const label = ruler && changeMapLabel(ruler, cut);
    return label ? [label] : [];
  });
}
export function littoralMapPoints(cut: LittoralCut, series?: LittoralSeries): LittoralMapState['points'] {
  const valid = cut.measurements.filter((value) => value.point && value.value !== null && value.quality !== 'no_data');
  const current: LittoralMapState['points']['features'] = valid.map((value) => ({
    type: 'Feature', id: value.transect_id + ':current', geometry: { type: 'Point', coordinates: value.point! },
    properties: { transect_id: value.transect_id, color: littoralColor(cut, value), kind: 'current' },
  }));
  const baseline = series?.cuts.find((entry) => entry.id === cut.baseline_observation_id);
  const comparable = new Set(valid.filter((value) => value.change_m !== null && value.change_m !== 0).map((value) => value.transect_id));
  const before: LittoralMapState['points']['features'] = baseline?.measurements.filter((value) => comparable.has(value.transect_id) && value.point && value.value !== null && value.quality !== 'no_data').map((value) => ({
    type: 'Feature', id: value.transect_id + ':baseline', geometry: { type: 'Point', coordinates: value.point! },
    properties: { transect_id: value.transect_id, color: '#263b38', kind: 'baseline' },
  })) ?? [];
  return { type: 'FeatureCollection', features: [...before, ...current] };
}

export function shortLittoralDate(value: string | null) {
  if (!value) return 'sin fecha';
  if (/^\d{4}$/.test(value)) return value;
  return new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
export function littoralPoints(cut: LittoralCut, transectId: string): ExplanationPoints {
  const measurement = littoralMeasurement(cut, transectId);
  const noData = cut.origin === 'gap' || !measurement || measurement.value === null || measurement.quality === 'no_data';
  if (noData) return [
    { label: 'Corte.', text: cut.period_label + ' · ' + (cut.origin === 'alec' ? 'Alec y colaboradores' : cut.origin === 'sentinel' ? 'Sentinel-2' : 'Sin mediciones') + '.' },
    { label: 'Medición.', text: 'Sin dato para esta barra. ' + (measurement?.reason ?? 'No se asigna cero ni se declara la playa estable.') },
    { label: 'Cómo leerlo.', text: cut.quality_note || 'La falta de una medición no demuestra ausencia de erosión.' },
  ];
  if (cut.origin === 'alec') return [
    { label: 'Corte histórico.', text: `Alec y colaboradores · ${cut.period_label}. Resume todo el intervalo, no un año ni una fotografía.` },
    { label: 'Medición.', text: `${measurement.value! < 0 ? 'Retroceso' : measurement.value! > 0 ? 'Avance' : 'Cambio'} medio publicado: ${Math.abs(measurement.value!).toLocaleString('es-MX', { maximumFractionDigits: 2 })} m/año. El largo de la barra no representa playa perdida.` },
    { label: 'Comparación.', text: 'Esta tasa no es la posición del agua de 2021. La serie reciente usa otra variable y aún necesita homologación.' },
  ];
  const delta = measurement.change_m;
  const baseline = cut.baseline_date ? shortLittoralDate(cut.baseline_date) : null;
  const change = delta === null ? 'Primera observación propia: sirve de referencia para las fechas siguientes.' : delta === 0 ? `La variación redondeada respecto al ${baseline} es aproximadamente 0 m; no demuestra que la playa esté estable.` : `Respecto al ${baseline}, el borde del agua aparece unos ${Math.abs(delta).toLocaleString('es-MX', { maximumFractionDigits: 0 })} m ${delta < 0 ? 'hacia tierra' : 'hacia el mar'}.`;
  return [
    { label: 'Agua en esta fecha.', text: `Sentinel-2 · ${shortLittoralDate(cut.datetime)}. El agua aparece a unos ${measurement.value!.toLocaleString('es-MX', { maximumFractionDigits: 0 })} m del origen técnico del eje.` },
    { label: 'Qué cambió.', text: change + ' Es distancia en metros, no una tasa de erosión.' },
    { label: 'Calidad.', text: 'Preliminar: píxeles de 10 m, valores redondeados a 5 m. Marea, oleaje y registro pendientes; no demuestra pérdida de arena.' },
  ];
}

export function littoralPairPoints(cut: LittoralCut, pair: TransectPair): ExplanationPoints {
  const point = (id: string, label: string) => {
    const measurement = littoralMeasurement(cut, id);
    if (cut.origin === 'gap' || !measurement || measurement.value === null || measurement.quality === 'no_data') return { label, text: 'Sin dato para esta barra. ' + (measurement?.reason ?? 'La falta de medición no demuestra que la costa esté estable.') };
    if (cut.origin === 'alec') return { label, text: `${measurement.value < 0 ? 'Retroceso' : measurement.value > 0 ? 'Avance' : 'Cambio'} medio publicado: ${Math.abs(measurement.value).toLocaleString('es-MX', { maximumFractionDigits: 2 })} m/año.` };
    const delta = measurement.change_m;
    const baseline = shortLittoralDate(cut.baseline_date);
    const change = delta === null ? 'Es la observación de referencia.' : delta === 0 ? `Variación redondeada: ≈0 m respecto al ${baseline}; no demuestra estabilidad.` : `Aparece unos ${Math.abs(delta).toLocaleString('es-MX', { maximumFractionDigits: 0 })} m ${delta < 0 ? 'hacia tierra' : 'hacia el mar'} respecto al ${baseline}.`;
    return { label, text: `Borde del agua: ≈${measurement.value.toLocaleString('es-MX', { maximumFractionDigits: 0 })} m desde el origen fijo de este eje. ${change}` };
  };
  return [
    point(pair.a.properties.idPol_Tran, 'Barra A.'),
    point(pair.b.properties.idPol_Tran, 'Barra B.'),
    { label: 'Fecha y alcance.', text: cut.origin === 'alec'
      ? `Alec et al. · ${cut.period_label}. Tasas del intervalo, sin medición continua del interior. La serie reciente necesita homologación.`
      : cut.origin === 'sentinel' ? `Sentinel-2 · ${shortLittoralDate(cut.datetime)}. Preliminar: marea y registro espacial pendientes. Se midieron los extremos; el interior no tiene medición continua.`
        : `${cut.period_label}. Sin mediciones para este corte; no se rellena el tramo con ceros.` },
  ];
}
