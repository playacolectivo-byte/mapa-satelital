import type { EvolutionIndex } from './coastal-evolution';
import type { ErosionData, ErosionFeature } from './problems';
import { geometryBounds, type Bounds } from './view.ts';

type SpatialEntry = { feature: ErosionFeature; bounds: Bounds };
const include = (bounds: Bounds, point: number[]) => {
  bounds[0] = Math.min(bounds[0], point[0]);
  bounds[1] = Math.min(bounds[1], point[1]);
  bounds[2] = Math.max(bounds[2], point[0]);
  bounds[3] = Math.max(bounds[3], point[1]);
};

/** Rendering index only. Include every real position and every model's extent,
 * so culling cannot discard an endpoint which moved outside its original axis.
 * No source geometry, observation, export or scientific coverage is modified. */
export function createEvolutionSpatialIndex(inventory: ErosionData, index: EvolutionIndex): SpatialEntry[] {
  const byId = new Map<string, SpatialEntry>();
  for (const feature of inventory.features) {
    const bounds = geometryBounds(feature.geometry);
    if (bounds) byId.set(feature.properties.idPol_Tran, { feature, bounds });
  }
  for (const values of index.values.values()) for (const [id, measurement] of values) {
    if (measurement.point && byId.has(id)) include(byId.get(id)!.bounds, measurement.point);
  }
  for (const model of index.trendCatalogue?.models ?? []) {
    const entry = byId.get(model.transect_id);
    const anchor = index.values.get(model.anchor_observation_id)?.get(model.transect_id);
    if (!entry || !anchor?.point) continue;
    const period = index.trendCatalogue!.periods[model.series];
    for (const year of [period.start, period.end]) {
      const elapsed = (Date.UTC(year, 6, 1, 12) - index.cutTimes.get(model.anchor_observation_id)!) / (365.2425 * 86400000);
      const delta = elapsed * model.rate_m_year;
      include(entry.bounds, [anchor.point[0] + delta * model.step_degrees_per_metre[0], anchor.point[1] + delta * model.step_degrees_per_metre[1]]);
    }
  }
  return [...byId.values()];
}

export function evolutionInventoryInView(entries: SpatialEntry[], bounds: Bounds, selectedId?: string | null): ErosionData {
  const padX = (bounds[2] - bounds[0]) * .25, padY = (bounds[3] - bounds[1]) * .25;
  const west = bounds[0] - padX, south = bounds[1] - padY, east = bounds[2] + padX, north = bounds[3] + padY;
  return { type: 'FeatureCollection', features: entries.filter(({ feature, bounds: b }) =>
    feature.properties.idPol_Tran === selectedId || b[0] <= east && b[2] >= west && b[1] <= north && b[3] >= south,
  ).map(entry => entry.feature) };
}
