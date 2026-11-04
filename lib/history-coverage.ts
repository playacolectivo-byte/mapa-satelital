import type { Bounds } from './view';
import type { ArchiveKind, HistoricalManifest } from './history';
export const REQUIRED_HISTORY_SCOPE = 'yucatan-coastal-navigation-17-v1';
export const REQUIRED_HISTORY_BOUNDS: Bounds = [-90.55, 20.65, -87.15, 22];
export type CoverageSource = ArchiveKind | 'esri' | 'sentinel';
export type CoverageReview = { source: CoverageSource; epoch_id: string; year: number; status: 'complete' | 'partial' | 'unreviewed'; reviewed_bounds: Bounds; reviewed_on: string; receipt: string; method: string };
export type HistoricalCoverageRegistry = { schema_version: 1; scope: { id: string; label: string; required_bounds: Bounds; locality_count: number; municipalities: string[] }; reviews: CoverageReview[] };
export function containsRequiredHistoryBounds(bounds: Bounds): boolean {
  return bounds[0] <= REQUIRED_HISTORY_BOUNDS[0] && bounds[1] <= REQUIRED_HISTORY_BOUNDS[1] && bounds[2] >= REQUIRED_HISTORY_BOUNDS[2] && bounds[3] >= REQUIRED_HISTORY_BOUNDS[3];
}
export function validateCoverageRegistry(value: unknown): HistoricalCoverageRegistry {
  const data = value as HistoricalCoverageRegistry;
  if (data?.schema_version !== 1 || data.scope?.id !== REQUIRED_HISTORY_SCOPE || JSON.stringify(data.scope.required_bounds) !== JSON.stringify(REQUIRED_HISTORY_BOUNDS) || data.scope.locality_count < 18 || !Array.isArray(data.scope.municipalities) || data.scope.municipalities.length < 13 || !data.scope.municipalities.includes('Ixil') || !Array.isArray(data.reviews)) throw new Error('Alcance histórico no comprobado');
  for (const r of data.reviews) if (!['landsat', 'inegi', 'nasa', 'geomedian', 'esri', 'sentinel'].includes(r.source) || !Number.isInteger(r.year) || !r.epoch_id || !['complete','partial','unreviewed'].includes(r.status) || r.reviewed_bounds?.length !== 4 || !r.reviewed_bounds.every(Number.isFinite) || !r.method || !r.receipt || !/^\d{4}-\d{2}-\d{2}$/.test(r.reviewed_on) || r.status === 'complete' && !containsRequiredHistoryBounds(r.reviewed_bounds)) throw new Error('Revisión de cobertura inválida');
  return data;
}
export function completeYearReview(registry: HistoricalCoverageRegistry | null, source: CoverageSource, year: number, epoch?: string): boolean {
  return !!registry?.reviews.some(r => r.source === source && r.year === year && (!epoch || r.epoch_id === epoch) && r.status === 'complete' && containsRequiredHistoryBounds(r.reviewed_bounds));
}
/** Partial source imagery remains preserved; only completed coverage enters choices. */
export function qualifiedHistoricalManifest(manifest: HistoricalManifest | null, source: ArchiveKind, registry: HistoricalCoverageRegistry | null): HistoricalManifest | null {
  if (!manifest) return null;
  const epochs = manifest.epochs.filter(e => {
    if (!completeYearReview(registry, source, e.year, e.id)) return false;
    const frames = manifest.frames.filter(f => f.epoch === e.id);
    if (frames.some(f => Number((f.capture_date ?? f.capture_month ?? String(f.capture_year)).slice(0,4)) !== e.year || f.period_start && Number(f.period_start.slice(0,4)) !== e.year || f.period_end && Number(f.period_end.slice(0,4)) !== e.year)) return false;
    const bounds: Bounds = [Math.min(...frames.map(f => f.bounds[0])),Math.min(...frames.map(f => f.bounds[1])),Math.max(...frames.map(f => f.bounds[2])),Math.max(...frames.map(f => f.bounds[3]))];
    return containsRequiredHistoryBounds(bounds);
  });
  const ids = new Set(epochs.map(e => e.id));
  return { ...manifest, epochs, frames: manifest.frames.filter(f => ids.has(f.epoch)) };
}
