import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiLineString,
  MultiPolygon,
} from 'geojson';
import type { ErosionFeature } from './problems';
import type { Bounds } from './view';

// Display batching only: every source coordinate and ring is retained verbatim.
// No union, simplification, buffering, clipping or new scientific boundaries.
export function batchTransects(
  features: ErosionFeature[],
): FeatureCollection<MultiLineString, { category: string; evolution_color?: string; evolution_status?:string }> {
  const groups = new Map<string, LineString['coordinates'][]>();
  const properties = new Map<string, { category: string; evolution_color?: string; evolution_status?:string }>();
  for (const feature of features) {
    if (['no_reference', 'no_observation'].includes(String(feature.properties.evolution_status))) continue;
    const category = feature.properties.category;
    const color = typeof feature.properties.evolution_color === 'string' ? feature.properties.evolution_color : undefined;
    const state=String(feature.properties.evolution_status??'');
    const key = (color ?? category)+(state==='estimated'?'|estimated':'');
    const coordinates = groups.get(key) ?? [];
    coordinates.push(feature.geometry.coordinates);
    groups.set(key, coordinates);
    properties.set(key, color ? { category, evolution_color: color,...(state==='estimated'?{evolution_status:state}:{}) } : { category });
  }
  return {
    type: 'FeatureCollection',
    features: [...groups].map(([key, coordinates]) => ({
      type: 'Feature',
      properties: properties.get(key)!,
      geometry: { type: 'MultiLineString', coordinates },
    })),
  };
}

export function batchOutlines(
  features: Feature<Geometry>[],
): FeatureCollection<MultiLineString | MultiPolygon> {
  const lines: MultiLineString['coordinates'] = [];
  const polygons: MultiPolygon['coordinates'] = [];
  for (const { geometry } of features) {
    if (geometry.type === 'LineString') lines.push(geometry.coordinates);
    else if (geometry.type === 'MultiLineString')
      lines.push(...geometry.coordinates);
    else if (geometry.type === 'Polygon') polygons.push(geometry.coordinates);
    else if (geometry.type === 'MultiPolygon')
      polygons.push(...geometry.coordinates);
  }
  const result: FeatureCollection<MultiLineString | MultiPolygon> = {
    type: 'FeatureCollection',
    features: [],
  };
  if (lines.length)
    result.features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiLineString', coordinates: lines },
    });
  if (polygons.length)
    result.features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiPolygon', coordinates: polygons },
    });
  return result;
}

export function boundsIntersect(a: Bounds, b: Bounds) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

// Pick the nearest real measurement line, rather than whichever overlapping
// SVG hit target happened to be added last. Called on click, never on each move.
export function nearestTransect<F extends Feature<LineString>>(
  features: F[],
  point: [number, number],
  project: (coordinate: number[]) => [number, number],
  maximum = 8,
): F | null {
  let nearest: F | null = null;
  let distance = maximum * maximum;
  for (const feature of features) {
    const coordinates = feature.geometry.coordinates;
    for (let i = 1; i < coordinates.length; i++) {
      const a = project(coordinates[i - 1]),
        b = project(coordinates[i]);
      const dx = b[0] - a[0],
        dy = b[1] - a[1];
      const fraction =
        dx || dy
          ? Math.max(
              0,
              Math.min(
                1,
                ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) /
                  (dx * dx + dy * dy),
              ),
            )
          : 0;
      const squared =
        (point[0] - a[0] - fraction * dx) ** 2 +
        (point[1] - a[1] - fraction * dy) ** 2;
      if (squared < distance) {
        distance = squared;
        nearest = feature;
      }
    }
  }
  return nearest;
}
