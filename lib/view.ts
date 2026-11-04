import type { Geometry } from 'geojson';

export type Bounds = [number, number, number, number];
export type Point = [number, number];
export function geometryBounds(geometry: Geometry): Bounds | null {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  function visit(value: unknown) {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      if (!Number.isFinite(value[0]) || !Number.isFinite(value[1])) return;
      west = Math.min(west, value[0]); south = Math.min(south, value[1]);
      east = Math.max(east, value[0]); north = Math.max(north, value[1]);
    } else value.forEach(visit);
  }
  function scan(g: Geometry) {
    if (g.type === 'GeometryCollection') g.geometries.forEach(scan);
    else visit(g.coordinates);
  }
  scan(geometry);
  return Number.isFinite(west) ? [west, south, east, north] : null;
}
export function project([lon, lat]: Point): Point {
  const rad = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
  return [(lon + 180) / 360, (1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2];
}
export function imageryTiles(center: Point, width: number, height: number, bounds?: Bounds) {
  let zoom = 14;
  let projected = project(center);
  if (bounds) {
    const a = project([bounds[0], bounds[3]]), b = project([bounds[2], bounds[1]]);
    projected = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    zoom = Math.max(9, Math.min(16, Math.floor(Math.log2(Math.min(
      width * .86 / (256 * Math.max(b[0] - a[0], 1e-8)),
      height * .86 / (256 * Math.max(b[1] - a[1], 1e-8))
    )))));
  }
  const n = 2 ** zoom;
  const left = projected[0] * n * 256 - width / 2;
  const top = projected[1] * n * 256 - height / 2;
  const tiles = [];
  for (let y = Math.floor(top / 256); y < Math.ceil((top + height) / 256); y++)
    for (let x = Math.floor(left / 256); x < Math.ceil((left + width) / 256); x++)
      tiles.push({ x, y, left: x * 256 - left, top: y * 256 - top, zoom });
  return tiles;
}
export function populationLabel(value: unknown): string {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '') return 'Información pendiente de integrar';
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n.toLocaleString('es-MX') : 'Información pendiente de integrar';
}
