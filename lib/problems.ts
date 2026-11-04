import type { Feature, FeatureCollection, LineString } from 'geojson';
import type { Bounds } from './view';

export type ResearchSeries = 'S2' | 'L5' | 'L8';
export type CoastCategory =
  | 'Erosión Alta'
  | 'Erosión Baja'
  | 'Estable'
  | 'Acreción Alta'
  | 'Acreción Baja';
export type ErosionFeature = Feature<
  LineString,
  {
    source_id: 'S34';
    series: ResearchSeries;
    idPol_Tran: string;
    rate: number;
    category: CoastCategory;
    [field: string]: unknown;
  }
>;
export type ErosionData = FeatureCollection<
  LineString,
  ErosionFeature['properties']
>;
export const researchSeries: {
  id: ResearchSeries;
  name: string;
  period: string;
  count: number;
}[] = [
  { id: 'S2', name: 'Sentinel-2', period: '2016–2021', count: 6992 },
  { id: 'L8', name: 'Landsat 8', period: '2013–2021', count: 5328 },
  { id: 'L5', name: 'Landsat 5', period: '1986–2011', count: 3385 },
];
export const erosionColor = (category: string) =>
  category === 'Erosión Alta'
    ? '#f46c55'
    : category === 'Erosión Baja'
      ? '#f4bd65'
      : category === 'Estable'
        ? '#a9bdc0'
        : '#4fc4ad';

// These are overlapping published regression periods, never annual observations.
export function publishedPeriodForYear(
  year: number | null,
): { series: ResearchSeries; containsYear: boolean } | null {
  if (year === null || !Number.isInteger(year) || year < 1986) return null;
  if (year <= 2011) return { series: 'L5', containsYear: true };
  if (year === 2012) return { series: 'L5', containsYear: false };
  if (year <= 2015) return { series: 'L8', containsYear: true };
  return { series: 'S2', containsYear: year <= 2021 };
}

export function mergePublishedTransects(datasets: ErosionData[]): ErosionData {
  const records = new Map<string, ErosionFeature>();
  for (const dataset of datasets)
    for (const feature of dataset.features) {
      const key = feature.properties.idPol_Tran;
      const previous = records.get(key);
      if (previous) {
        if (
          JSON.stringify(previous.geometry) !== JSON.stringify(feature.geometry)
        )
          throw new Error('Conflicting transect geometry: ' + key);
        for (const field of [
          'LRR_S2',
          'LRR_L5',
          'LRR_L8',
          'ClasVulS2',
          'ClasVulL5',
          'ClasVulL8',
        ])
          if (previous.properties[field] !== feature.properties[field])
            throw new Error('Conflicting published value: ' + key);
      } else
        records.set(key, {
          ...feature,
          id: 'S34-' + key,
          properties: { ...feature.properties },
        });
    }
  return { type: 'FeatureCollection', features: [...records.values()] };
}

export function publishedValues(
  feature: ErosionFeature,
  series: ResearchSeries,
): { rate: number; category: CoastCategory } | null {
  const rate = feature.properties['LRR_' + series];
  const category = feature.properties['ClasVul' + series];
  if (
    typeof rate !== 'number' ||
    !Number.isFinite(rate) ||
    ![
      'Erosión Alta',
      'Erosión Baja',
      'Estable',
      'Acreción Alta',
      'Acreción Baja',
    ].includes(String(category))
  )
    return null;
  return { rate, category: category as CoastCategory };
}

export function selectPublishedPeriod(
  inventory: ErosionData,
  series: ResearchSeries,
): ErosionData {
  const features: ErosionFeature[] = [];
  for (const feature of inventory.features) {
    const values = publishedValues(feature, series);
    if (values)
      features.push({
        ...feature,
        properties: {
          ...feature.properties,
          series,
          rate: values.rate,
          category: values.category,
        },
      });
  }
  return { type: 'FeatureCollection', features };
}
export const S34_URL = 'https://doi.org/10.1016/j.rsma.2023.103247';
export const GEOTUBE_URL =
  'https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2022.889820/full';
export const AUTHORS_KMZ =
  'https://www.dropbox.com/s/8pok6qgc0ow04n5/Cambio%20l%C3%ADnea%20costa.kmz?dl=1';
// Dataset extent for navigation only; it is not a coastal cell boundary.
export const RESEARCH_BOUNDS: Bounds = [
  -90.4163222800293, 20.775654761325, -89.2098471985757, 21.350129167024,
];
// Broad viewing window read from Mendoza et al. (2022), Fig. 1C graticule.
// This is not a digitized structure, study polygon or accepted georeferencing control.
export const SAN_MIGUEL_VIEW: Bounds = [-89.57, 21.3, -89.545, 21.318];
export const mentionedCells = [
  {
    name: 'Yucalpetén–Chuburná',
    note: 'Ejemplo de celda en la junta; límites por validar.',
  },
  {
    name: 'Chuburná–boca de la Carbonera',
    note: 'Tramo discutido; verificar posición y evolución de la boca.',
  },
  {
    name: 'Carbonera–escollera oriental de Sisal',
    note: 'Tramo discutido; sin deslinde recibido.',
  },
  {
    name: 'Playa de Progreso',
    note: 'Se planteó como unidad propia; falta precisar sus extremos.',
  },
  {
    name: 'Sisal hacia Punta Piedra / El Palmar',
    note: 'Posibles divisiones por curvatura; propuesta sin cerrar.',
  },
  {
    name: 'Progreso–Telchac / Punta San Miguel',
    note: 'Sector de discusión con posibles divisiones internas; no una celda única confirmada.',
  },
  {
    name: 'Dzilam–San Felipe–Río Lagartos',
    note: 'Bocas y manglares mencionados; nombres y límites por cotejar.',
  },
];
