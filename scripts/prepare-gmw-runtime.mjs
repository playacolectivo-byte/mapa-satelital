import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const intake = resolve(
  process.argv[2] ?? 'scientific/catalogue/gmw-annual-2026-10-23',
);
const output = resolve('public/data/problems/gmw');
const original = JSON.parse(
  await readFile(
    resolve(
      intake,
      'derived-gmw-estimated-classes/gmw-annual-changes-2011-2025-chelem-progreso.geojson',
    ),
    'utf8',
  ),
);
const manifest = JSON.parse(
  await readFile(
    resolve(intake, 'derived-gmw-estimated-classes/gmw-change-manifest.json'),
    'utf8',
  ),
);
assert.equal(manifest.source.license, 'CC-BY-4.0');
assert.equal(manifest.source.version, '4.1.12');
assert.equal(manifest.derivation.simplification, false);
assert.equal(
  manifest.analysis_domain
    .per_pixel_infill_or_actual_observation_mask_available,
  false,
);
const features = original.features.map((feature) => {
  const p = feature.properties;
  assert.equal(p.source_id, 'GMW4112');
  assert.equal(p.resolution_m, 30);
  assert.equal(p.previous_year, p.year - 1);
  assert.ok(['loss', 'gain'].includes(p.change));
  assert.ok(p.area_ha > 0);
  return {
    type: 'Feature',
    id: feature.id,
    geometry: feature.geometry,
    properties: {
      source_id: p.source_id,
      year: p.year,
      previous_year: p.previous_year,
      change: p.change,
      area_ha: p.area_ha,
      resolution_m: p.resolution_m,
    },
  };
});
assert.equal(
  new Set(features.map((feature) => feature.id)).size,
  features.length,
);
for (const comparison of manifest.annual_comparisons) {
  const matching = features.filter(
    (feature) => feature.properties.year === comparison.year,
  );
  for (const change of ['loss', 'gain']) {
    const area = matching
      .filter((feature) => feature.properties.change === change)
      .reduce((sum, feature) => sum + feature.properties.area_ha * 10000, 0);
    assert.ok(Math.abs(area - comparison[change + '_area_m2']) < 0.00001);
  }
}
await mkdir(output, { recursive: true });
await writeFile(
  resolve(output, 'annual-changes.geojson'),
  JSON.stringify({ type: 'FeatureCollection', features }) + '\n',
);
await writeFile(
  resolve(output, 'manifest.json'),
  JSON.stringify(manifest) + '\n',
);
console.log(
  'GMW runtime prepared: ' +
    features.length +
    ' original cell-boundary polygons; geometry and areas unchanged, repeated descriptive properties retained in the intake.',
);
