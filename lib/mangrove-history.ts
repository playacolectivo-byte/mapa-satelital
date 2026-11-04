import type { EvidenceData, EvidenceFeature } from './map-evidence';
import type { Bounds } from './view';

export type MangroveComparison = {
  year: number;
  previous_year: number;
  loss_area_m2: number;
  gain_area_m2: number;
  current_coverage_m2: number;
};
export type MangroveManifest = {
  source: { version: string; doi: string; license: string; credit: string };
  query_bounds_wgs84: Bounds;
  annual_comparisons: MangroveComparison[];
};
export type DatedMangroveComparison = MangroveComparison & {
  reference: boolean;
};
export const GMW_SOURCE = 'https://doi.org/10.5281/zenodo.21346457';
export const GMW_LOSS = '#f46c55';
export const GMW_GAIN = '#4fc4ad';
export const isMangroveChange = (feature: EvidenceFeature) =>
  feature.properties.source_id === 'GMW4112';
export const mangroveChangeColor = (feature: EvidenceFeature) =>
  feature.properties.change === 'loss' ? GMW_LOSS : GMW_GAIN;

// Missing years do not become zero change. Only a known older comparison may
// be shown as a reference when the user has enabled historical references.
export function mangroveComparisonForYear(
  manifest: MangroveManifest | null,
  year: number | null,
  references: boolean,
): DatedMangroveComparison | null {
  if (!manifest || year === null || !Number.isInteger(year)) return null;
  const exact = manifest.annual_comparisons.find(
    (comparison) => comparison.year === year,
  );
  if (exact) return { ...exact, reference: false };
  if (!references) return null;
  const older = manifest.annual_comparisons
    .filter((comparison) => comparison.year < year)
    .sort((a, b) => b.year - a.year)[0];
  return older ? { ...older, reference: true } : null;
}

export function selectMangroveComparison(
  data: EvidenceData | null,
  comparison: DatedMangroveComparison | null,
): EvidenceData {
  return {
    type: 'FeatureCollection',
    features: comparison
      ? (data?.features.filter(
          (feature) =>
            feature.properties.year === comparison.year &&
            feature.properties.previous_year === comparison.previous_year,
        ) ?? [])
      : [],
  };
}
