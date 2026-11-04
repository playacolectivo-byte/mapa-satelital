import type { Feature, FeatureCollection, Point } from 'geojson';
import type { Bounds } from './view';

export const STRUCTURES_ARTICLE = 'https://doi.org/10.1038/s41598-026-38793-0';
export const STRUCTURES_REPOSITORY = 'https://doi.org/10.5281/zenodo.17307790';
export const STRUCTURES_BOUNDS: Bounds = [-90.402281, 20.85866, -87.677947, 21.612904];
export const structureTypes = [
  { value: 'Groin', label: 'Espolones', count: 322 },
  { value: 'Jetty', label: 'Escolleras', count: 12 },
  { value: 'Port', label: 'Puertos', count: 3 },
  { value: 'Pier', label: 'Muelles', count: 22 },
] as const;
export type StructureFilter = 'all' | typeof structureTypes[number]['value'];
export type StructureFeature = Feature<Point, {
  record_id: string; source_id: 'MC2026'; source_row_1based: number;
  Ocean: string; State: 'Yucatan'; Year: 1995 | 2019; Longitude: number; Latitude: number;
  'Type of st': Exclude<StructureFilter, 'all'>; type_label: string; source_url: string;
}>;
export type StructureData = FeatureCollection<Point, StructureFeature['properties']>;

// Camera window only. This rectangle is never drawn as a footprint or boundary.
export function structureView(feature: StructureFeature): Bounds {
  const [lon, lat] = feature.geometry.coordinates;
  return [lon - .004, lat - .003, lon + .004, lat + .003];
}

export function isStructureData(value: unknown): value is StructureData {
  if (!value || typeof value !== 'object' || !('features' in value) || !Array.isArray(value.features)) return false;
  return value.features.length === 359 && value.features.every(feature => {
    const p = feature?.properties, g = feature?.geometry;
    return feature?.type === 'Feature' && g?.type === 'Point' && Array.isArray(g.coordinates) &&
      Number.isFinite(g.coordinates[0]) && Number.isFinite(g.coordinates[1]) &&
      g.coordinates[0] === p?.Longitude && g.coordinates[1] === p?.Latitude &&
      p?.State === 'Yucatan' && p?.source_id === 'MC2026' && typeof p?.record_id === 'string' &&
      [1995,2019].includes(p?.Year) && structureTypes.some(type => type.value === p?.['Type of st']);
  });
}
