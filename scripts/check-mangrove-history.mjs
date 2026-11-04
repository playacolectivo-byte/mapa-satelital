import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  mangroveComparisonForYear,
  selectMangroveComparison,
} from '../lib/mangrove-history.ts';

const read = async (path) =>
  JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const base = 'scientific/catalogue/gmw-annual-2026-10-23/';
const manifest = await read('public/data/problems/gmw/manifest.json');
const runtime = await read('public/data/problems/gmw/annual-changes.geojson');
const original = await read(
  base +
    'derived-gmw-estimated-classes/gmw-annual-changes-2011-2025-chelem-progreso.geojson',
);
const tile = await readFile(
  new URL('../' + base + manifest.source.file, import.meta.url),
);
assert.equal(
  createHash('sha256').update(tile).digest('hex'),
  manifest.source.sha256,
);
assert.equal(manifest.source.license, 'CC-BY-4.0');
assert.equal(manifest.source_raster.count, 41);
assert.equal(manifest.source_raster.source_nodata_metadata, 0);
assert.equal(manifest.source_mask_contradiction.zero_policy_explicit, true);
assert.equal(
  manifest.analysis_domain
    .per_pixel_infill_or_actual_observation_mask_available,
  false,
);
assert.equal(manifest.derivation.simplification, false);
assert.equal(manifest.derivation.buffering, false);
assert.equal(runtime.features.length, 8704);
assert.equal(original.features.length, runtime.features.length);
const sourceById = new Map(
  original.features.map((feature) => [feature.id, feature]),
);
for (const feature of runtime.features) {
  const source = sourceById.get(feature.id);
  assert.ok(source);
  assert.deepEqual(feature.geometry, source.geometry);
  for (const field of Object.keys(feature.properties))
    assert.equal(feature.properties[field], source.properties[field]);
  assert.ok(feature.properties.area_ha > 0);
  assert.equal(feature.properties.source_id, 'GMW4112');
  assert.equal(feature.properties.resolution_m, 30);
  assert.equal(feature.properties.previous_year, feature.properties.year - 1);
}
assert.equal(
  new Set(runtime.features.map((feature) => feature.id)).size,
  runtime.features.length,
);
assert.equal(manifest.annual_comparisons.length, 15);
for (const comparison of manifest.annual_comparisons) {
  const resolved = mangroveComparisonForYear(manifest, comparison.year, false);
  assert.equal(resolved.reference, false);
  const data = selectMangroveComparison(runtime, resolved);
  assert.equal(data.features.length, comparison.components);
  for (const change of ['loss', 'gain']) {
    const area = data.features
      .filter((feature) => feature.properties.change === change)
      .reduce((sum, feature) => sum + feature.properties.area_ha * 10000, 0);
    assert.ok(Math.abs(area - comparison[change + '_area_m2']) < 0.00001);
  }
}
for (const qa of manifest.qa) {
  assert.equal(qa.vector_raster_mismatch_pixels, 0);
  assert.ok(Math.abs(qa.area_balance_error_m2) < 1);
}
assert.equal(mangroveComparisonForYear(manifest, null, true), null);
assert.equal(mangroveComparisonForYear(manifest, 2010, true), null);
assert.equal(mangroveComparisonForYear(manifest, 2026, false), null);
assert.equal(mangroveComparisonForYear(manifest, 2026, true).year, 2025);
assert.equal(mangroveComparisonForYear(manifest, 2026, true).reference, true);
assert.equal(selectMangroveComparison(runtime, null).features.length, 0);
console.log(
  'Mangrove history: original tile SHA-256, 8,704 unchanged cell polygons, 15 dated comparisons, source area totals, missing years and explicit reference rules verified.',
);
