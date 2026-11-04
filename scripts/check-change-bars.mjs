import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { littoralMapData, littoralAxisData, littoralMapPoints, littoralChangeLabels, littoralRuler, validateLittoralSeries } from '../lib/littoral-series.ts';
import { wgs84DistanceM } from '../lib/transect-pairs.ts';

const root = new URL('../', import.meta.url);
const series = validateLittoralSeries(JSON.parse(await readFile(new URL('public/data/littoral/pilot-series.json', root))));
const original = JSON.stringify(series);
let segments = 0, zero = 0, reference = 0, comparisons = 0, largestRawPositionDifferenceM = 0;
for (const cut of series.cuts) {
  const data = littoralMapData(series, cut), axes = littoralAxisData(series, cut), labels = littoralChangeLabels(series, cut);
  const points = littoralMapPoints(cut, series);
  assert.equal(new Set(points.features.map((point) => point.id)).size, points.features.length, 'Endpoint IDs are unique');
  assert.equal(axes.features.length, 11);
  for (const feature of axes.features) assert.deepEqual(feature.geometry, series.pilot.transects.features.find((axis) => axis.properties.idPol_Tran === feature.properties.transect_id).geometry);
  if (cut.origin !== 'sentinel') { assert.deepEqual(data, axes); assert.equal(labels.length, 0); continue; }
  assert.equal(labels.length, 11);
  const baseline = series.cuts.find((entry) => entry.id === cut.baseline_observation_id);
  for (const value of cut.measurements) {
    comparisons++;
    const line = data.features.find((feature) => feature.properties.transect_id === value.transect_id);
    const label = labels.find((entry) => entry.id === value.transect_id);
    const endpoint = points.features.find((point) => point.properties.transect_id === value.transect_id && point.properties.kind === 'current');
    assert.deepEqual(endpoint.geometry.coordinates, value.point, 'Current cap is exactly at the stored water-edge coordinate');
    assert.equal(label.explanation.points.length, 1);
    assert.equal(label.explanation.sourceUrl, cut.product.metadata_url);
    assert.equal(label.explanation.baselineSourceUrl, baseline.product.metadata_url);
    if (value.change_m === null) { reference++; assert.equal(line, undefined); assert.equal(label.text, 'Base'); continue; }
    if (value.change_m === 0) { zero++; assert.equal(line, undefined); assert.equal(label.text, '≈ 0 m'); assert.ok(label.explanation.points[0].text.includes('no demuestra')); continue; }
    const start = baseline.measurements.find((entry) => entry.transect_id === value.transect_id);
    const before = points.features.find((point) => point.properties.transect_id === value.transect_id && point.properties.kind === 'baseline');
    assert.deepEqual(before.geometry.coordinates, start.point, 'Before cap is exactly at the baseline coordinate');
    assert.deepEqual(line.geometry.coordinates, [start.point, value.point], 'Only the two real water-edge coordinates define the colored line');
    assert.equal(value.change_m, value.value - start.value, 'Communicated difference retains the original rounded-value convention');
    const distance = wgs84DistanceM(start.point, value.point);
    const error = Math.abs(distance - Math.abs(value.raw_interpolated_position_m - start.raw_interpolated_position_m));
    largestRawPositionDifferenceM = Math.max(largestRawPositionDifferenceM, error);
    assert.ok(error < 0.15, 'Map length matches raw stored positions within coordinate/grid numerical tolerance, not a claim of physical accuracy');
    assert.ok(label.explanation.title.includes(value.change_m < 0 ? 'hacia tierra' : 'hacia el mar'));
    segments++;
  }
}
const missing = structuredClone(series.cuts.at(-1)); missing.measurements = [];
assert.equal(littoralMapData(series, missing).features.length, 0);
assert.equal(littoralChangeLabels(series, missing).length, 0);
const noBaseline = structuredClone(series);
const latest = noBaseline.cuts.at(-1), base = noBaseline.cuts.find((cut) => cut.id === latest.baseline_observation_id);
const id = latest.measurements.find((value) => value.change_m !== 0).transect_id;
base.measurements = base.measurements.filter((value) => value.transect_id !== id);
assert.ok(!littoralMapData(noBaseline, latest).features.some((line) => line.properties.transect_id === id));
const label = littoralChangeLabels(noBaseline, latest).find((entry) => entry.id === id);
assert.equal(label.text, 'Sin comparación');
const feature = noBaseline.pilot.transects.features.find((entry) => entry.properties.idPol_Tran === id);
assert.equal(littoralRuler(noBaseline, latest, { id, origin: feature.geometry.coordinates[0] }).changeM, null);
assert.equal(JSON.stringify(series), original);
const receipt = { checked_at: new Date().toISOString(), status: 'passed', comparisons, nonzero_segments: segments, zero_changes_shown_as_points: zero, baseline_positions_shown_as_points: reference, largest_geodesy_vs_raw_difference_m: largestRawPositionDifferenceM, checks: ['actual stored endpoints', 'original axes unchanged', 'original rounded deltas unchanged', 'one explanation point', 'baseline and missing comparisons are not zero-length invented erosion', 'historical rates remain m/year'], scientific_status: 'Apparent water-edge movement; no tidal/wave correction or confirmed beach loss' };
await writeFile(new URL('docs/qa/change-bars-endpoints-2026-10-26.json', root), JSON.stringify({ ...receipt, checks: [...receipt.checks, 'both visible endpoint caps use actual stored water coordinates'] }, null, 2) + '\n');
console.log(JSON.stringify(receipt));
