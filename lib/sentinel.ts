import type { Geometry } from 'geojson';
import type { Bounds, Point } from './view';

export type SentinelScene = {
  id: string; sector: string; datetime: string; platform: string; resolution_m: number;
  cloud_cover_scene_pct: number; bbox: Bounds; geometry: Geometry; tiles: string;
  native_zoom: number; metadata_url: string; asset_url: string; tide_m: number | null;
};
export type SentinelManifest = {
  prepared_on: string; source: string; method: string; limitations: string;
  sectors: { id: string; name: string; point: Point; tile: string }[];
  scenes: SentinelScene[]; missing: { sector: string; year: number; reason: string[] }[];
};
export const sentinelDate = (datetime: string) => new Date(datetime).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export function sceneContains(scene: SentinelScene, point: Point) {
  const [x, y] = point;
  function ringContains(ring: number[][]) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function polygonContains(rings: number[][][]) { return !!rings[0] && ringContains(rings[0]) && !rings.slice(1).some(ringContains); }
  const geometry = scene.geometry;
  return geometry.type === 'Polygon' ? polygonContains(geometry.coordinates) : geometry.type === 'MultiPolygon' ? geometry.coordinates.some(polygonContains) : false;
}
