import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateHistoricalManifest, historicalEpochForYear } from '../lib/history.ts';
import { validateCoverageRegistry, qualifiedHistoricalManifest, REQUIRED_HISTORY_BOUNDS } from '../lib/history-coverage.ts';
const root = new URL('../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const raw = await json('public/data/history/geomedian.json');
const manifest = validateHistoricalManifest(raw);
const registry = validateCoverageRegistry(await json('public/data/history/coverage-reviews.json'));
const qualified = qualifiedHistoricalManifest(manifest, 'geomedian', registry);
assert.equal(qualified.epochs.length, 33);
assert.equal(qualified.frames.length, 33);
assert.equal(registry.scope.locality_count, 18);
assert.equal(registry.scope.municipalities.length, 13);
assert.ok(registry.scope.municipalities.includes('Ixil'));
for (let year = 1993; year <= 2025; year++) {
  const epoch = historicalEpochForYear(qualified, year);
  assert.equal(epoch?.year, year);
  const frame = qualified.frames.find(f => f.epoch === epoch.id);
  assert.equal(frame.capture_year, year);
  assert.equal(frame.date_precision, 'year');
  assert.equal(frame.capture_date, undefined);
  assert.equal(frame.wms.layers, `Sitio_Inegi:gm_colornatural_${year}`);
  assert.ok(frame.tiles.includes('bbox={bbox-epsg-3857}'));
  assert.ok(frame.tiles.startsWith('https://mapas.inegi.org.mx/geoserver/Sitio_Inegi/wms?'));
}
for (let year = 1972; year < 1993; year++) assert.equal(historicalEpochForYear(qualified, year), null);
assert.equal(historicalEpochForYear(qualified, 2026), null);
// Missing/partial coverage cannot expose a year, even when a valid adjacent year exists.
const partialRegistry = structuredClone(registry);
partialRegistry.reviews.find(r => r.source === 'geomedian' && r.year === 2025).status = 'partial';
assert.equal(historicalEpochForYear(qualifiedHistoricalManifest(manifest, 'geomedian', partialRegistry), 2025), null);
assert.equal(historicalEpochForYear(qualifiedHistoricalManifest(manifest, 'geomedian', null), 2025), null);
// Per-year review cannot rescue a frame with another year's period or a partial extent.
for (const mutate of [
  f => { f.period_start = '2024-12-01'; },
  f => { f.bounds = [-89.9, 21.2, -89.5, 21.4]; },
]) {
  const changed = structuredClone(manifest);
  mutate(changed.frames.find(f => f.capture_year === 2025));
  assert.equal(historicalEpochForYear(qualifiedHistoricalManifest(changed, 'geomedian', registry), 2025), null);
}
// Only the reviewed official WMS contract is allowed, never arbitrary remote tile URLs.
for (const mutate of [
  f => { f.wms.url = 'https://example.com/wms'; },
  f => { f.wms.layers = 'Sitio_Inegi:gm_colornatural_2024'; },
  f => { f.wms.crs = 'EPSG:4326'; },
  f => { f.tile_size = 512; },
]) {
  const changed = structuredClone(raw);
  mutate(changed.frames.find(f => f.capture_year === 2025));
  assert.throws(() => validateHistoricalManifest(changed));
}
const partialCounts = {};
for (const [kind, path] of [['landsat','landsat-tiles.json'],['inegi','manifest.json'],['nasa','nasa-gweld.json']]) {
  const old = validateHistoricalManifest(await json('public/data/history/' + path));
  const accepted = qualifiedHistoricalManifest(old, kind, registry);
  assert.equal(accepted.epochs.length, 0, `${kind}: partial or non-calendar imagery must remain excluded`);
  partialCounts[kind] = old.epochs.length;
}
const digest = async path => createHash('sha256').update(await readFile(new URL(path, root))).digest('hex');
const report = {
  checked_at: new Date().toISOString(), status: 'passed',
  required_bounds: REQUIRED_HISTORY_BOUNDS, reviewed_locality_points: registry.scope.locality_count,
  municipalities: registry.scope.municipalities.length, available_years: [1993, 2025], available_year_count: 33,
  excluded_archive_epoch_counts: partialCounts,
  checks: ['Every qualified year uses its own official INEGI layer', 'No exact year means no background, including 2026', 'No review, partial review, partial rectangle or cross-year period cannot expose a map', 'Only the official INEGI WMS endpoint and per-year layer are accepted', 'Partial existing archives remain outside annual background options', 'Annual mosaics expose no single capture day'],
  manifest_sha256: await digest('public/data/history/geomedian.json'),
  coverage_registry_sha256: await digest('public/data/history/coverage-reviews.json'),
};
await writeFile(new URL('docs/qa/strict-annual-backgrounds-2026-10-28.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
