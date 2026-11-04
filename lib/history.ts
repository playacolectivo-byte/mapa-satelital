import type { Polygon } from 'geojson';
import type { Bounds } from './view';

export type HistoricalFrame = {
  id: string; sheet: string; epoch: string; capture_month?: string; capture_date?: string; capture_year?: number; date_precision: 'month' | 'day' | 'year';
  period_start?: string; period_end?: string;
  attribution?: string;
  tile_protocol?: 'xyz' | 'wms';
  wms?: { url: string; layers: string; version: '1.1.1'; format: 'image/png'; crs: 'EPSG:3857' };
  resolution_m: number; bounds: Bounds; footprint: Polygon; tiles: string;
  minzoom: number; maxzoom: number; tile_size: number;
  catalogue_url: string; original_url: string; metadata_url: string; note: string;
};
export type HistoricalEpoch = { id: string; year: number; label: string; short_label: string; resolution_m: number };
export type HistoricalManifest = {
  schema_version: number; prepared_on: string; attribution: string;
  frames: HistoricalFrame[]; epochs: HistoricalEpoch[]; comparison_bounds: Bounds;
  method: string; limits: string;
};

export type ArchiveKind = 'landsat' | 'inegi' | 'nasa' | 'geomedian';
export function validateHistoricalManifest(value: unknown): HistoricalManifest {
  const data = value as HistoricalManifest;
  if (data?.schema_version !== 1 || !Array.isArray(data.frames) || !Array.isArray(data.epochs) || !data.epochs.length) throw new Error('Archivo histórico sin fechas');
  const epochs = new Set(data.epochs.map(epoch => epoch.id));
  const ids = new Set<string>();
  for (const frame of data.frames) {
    const wms = frame.wms;
    const wmsTiles = frame.tile_protocol === 'wms' && wms?.url === 'https://mapas.inegi.org.mx/geoserver/Sitio_Inegi/wms' && wms.layers === 'Sitio_Inegi:gm_colornatural_' + frame.capture_year && Number(frame.capture_year) >= 1993 && Number(frame.capture_year) <= new Date().getUTCFullYear() && wms.version === '1.1.1' && wms.format === 'image/png' && wms.crs === 'EPSG:3857' && frame.date_precision === 'year' && frame.tile_size === 256;
    const localTiles = frame.tiles?.startsWith('/data/history/') && frame.tiles.includes('{z}/{x}/{y}');
    const nasaTiles = /^https:\/\/gibs\.earthdata\.nasa\.gov\/wmts\/epsg3857\/best\/Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual\/default\/\d{4}-\d{2}-\d{2}\/GoogleMapsCompatible_Level12\/\{z\}\/\{y\}\/\{x\}\.jpg$/.test(frame.tiles ?? '');
    if (!frame.id || ids.has(frame.id) || !epochs.has(frame.epoch) || !(localTiles || nasaTiles || wmsTiles)
      || ![256, 512].includes(frame.tile_size) || nasaTiles && (frame.tile_size !== 256 || frame.date_precision !== 'year')
      || !['month', 'day', 'year'].includes(frame.date_precision)
      || frame.date_precision !== 'year' && !/^\d{4}-\d{2}$/.test(frame.capture_month ?? '')
      || frame.date_precision === 'day' && !/^\d{4}-\d{2}-\d{2}$/.test(frame.capture_date ?? '')
      || frame.date_precision === 'year' && (!Number.isInteger(frame.capture_year) || !!frame.capture_date || !!frame.capture_month)
      || frame.bounds?.length !== 4 || !frame.bounds.every(Number.isFinite) || frame.bounds[0] >= frame.bounds[2] || frame.bounds[1] >= frame.bounds[3]
      || frame.footprint?.type !== 'Polygon' || !Number.isInteger(frame.minzoom) || !Number.isInteger(frame.maxzoom) || frame.minzoom > frame.maxzoom) throw new Error('Tesela histórica sin fecha o cobertura válida');
    ids.add(frame.id);
  }
  for (const epoch of data.epochs) if (!Number.isInteger(epoch.year) || !epoch.id.startsWith(String(epoch.year)) || !data.frames.some(frame => frame.epoch === epoch.id)) throw new Error('Fecha histórica sin imágenes');
  return { ...data, frames: data.frames.map(frame => frame.tile_protocol === 'wms' ? { ...frame, tiles: historicalWmsTemplate(frame) } : frame) };
}

/** Strict annual selection: unavailable years never reuse another year's image. */
export function historicalEpochForYear(manifest: HistoricalManifest | null, year: number): HistoricalEpoch | null {
  return [...(manifest?.epochs ?? [])].filter(epoch => epoch.year === year).sort((a, b) => a.id.localeCompare(b.id)).at(-1) ?? null;
}

export function historicalWmsTemplate(frame: HistoricalFrame): string {
  if (!frame.wms) throw new Error('Servicio WMS ausente');
  return frame.wms.url + '?service=WMS&version=1.1.1&request=GetMap&layers=' + encodeURIComponent(frame.wms.layers) + '&styles=&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/png&transparent=true';
}

export function historicalEpochBounds(manifest: HistoricalManifest | null, epoch: string | null): Bounds | null {
  const frames = manifest?.frames.filter(frame => frame.epoch === epoch) ?? [];
  if (!frames.length) return null;
  return [Math.min(...frames.map(f => f.bounds[0])), Math.min(...frames.map(f => f.bounds[1])), Math.max(...frames.map(f => f.bounds[2])), Math.max(...frames.map(f => f.bounds[3]))];
}

export function historicalEpochCovered(manifest: HistoricalManifest | null, epoch: string | null, point: [number, number] | null): boolean {
  return !point || !!manifest?.frames.some(frame => frame.epoch === epoch && inFootprint(point, frame));
}

/** Keep every layer in the renderer registry so switching archives hides old tiles. */
export function combineHistoricalManifests(manifests: (HistoricalManifest | null)[]): HistoricalManifest | null {
  const received = manifests.filter((m): m is HistoricalManifest => !!m);
  if (!received.length) return null;
  return { ...received[0], attribution: 'Archivos INEGI, Landsat y NASA GIBS · fechas propias',
    frames: received.flatMap(manifest => manifest.frames.map(frame => ({ ...frame, attribution: frame.attribution ?? manifest.attribution }))),
    epochs: received.flatMap(manifest => manifest.epochs),
  };
}

// Coverage is the actual georeferenced raster, not the nominal catalogue sheet.
export function inFootprint(point: [number, number], frame: HistoricalFrame): boolean {
  const ring = frame.footprint.coordinates[0];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
