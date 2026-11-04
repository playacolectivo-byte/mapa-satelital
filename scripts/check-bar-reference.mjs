import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createTransectIndex, barFootprint, transectCentre, wgs84DistanceM } from '../lib/transect-pairs.ts';
import { mergePublishedTransects } from '../lib/problems.ts';
import { littoralRuler, barMapLabels, validateLittoralSeries, littoralPoints } from '../lib/littoral-series.ts';

const root = new URL('../', import.meta.url);
const json = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const series = validateLittoralSeries(await json('public/data/littoral/pilot-series.json'));
const datasets = await Promise.all(['s2', 'l5', 'l8'].map((id) => json('public/data/problems/s34-' + id + '.geojson')));
const inventory = mergePublishedTransects(datasets);
const pilot = createTransectIndex(series.pilot.transects.features), regional = createTransectIndex(inventory.features);
const original = JSON.stringify([series, datasets]);
let checked = 0, largestPartitionErrorM = 0;
for (const index of [pilot, regional]) {
  const groups = new Map();
  for (const feature of index.features) {
    const id = feature.properties.idPol_Tran, footprint = barFootprint(feature, index);
    checked++;
    assert.equal(footprint.id, id, 'Select the clicked axis itself, including the last bar');
    assert.equal(footprint.feature, feature, 'Retain original axis object and geometry');
    assert.ok(footprint.axisLengthM > 0);
    assert.ok(footprint.frontM > 0);
    assert.equal(footprint.ticks.features.length, 2);
    assert.equal(footprint.front.geometry.coordinates.length, 3);
    const group = id.split('_')[0];
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({ feature, footprint });
    if (index.previous.has(id)) assert.equal(index.previous.get(id).properties.idPol_Tran.split('_')[0], group);
    if (index.next.has(id)) assert.equal(index.next.get(id).properties.idPol_Tran.split('_')[0], group);
  }
  for (const entries of groups.values()) {
    assert.ok(entries[0].footprint.partial && entries.at(-1).footprint.partial);
    const expected = entries.slice(1).reduce((sum, entry, i) => sum + wgs84DistanceM(transectCentre(entries[i].feature), transectCentre(entry.feature)), 0);
    const actual = entries.reduce((sum, entry) => sum + entry.footprint.frontM, 0);
    const error = Math.abs(actual - expected);
    largestPartitionErrorM = Math.max(largestPartitionErrorM, error);
    assert.ok(error < .01, 'Reference fronts partition the known centre path without extrapolating past group ends');
  }
}
const selected = barFootprint(pilot.byId.get('P16_T499'), pilot);
assert.ok(Math.abs(selected.frontM - 29.692154568475065) < .000001);
assert.ok(Math.abs(selected.axisLengthM - 99.95795493129081) < .000001);
assert.notEqual(selected.frontM, selected.axisLengthM, 'Along-front reference and cross-shore axis length are distinct');
for (const cut of series.cuts) for (const feature of pilot.features) {
  const footprint = barFootprint(feature, pilot), ruler = littoralRuler(series, cut, footprint);
  assert.equal(littoralPoints(cut, footprint.id).length, 3);
  const labels = barMapLabels(footprint, ruler, cut);
  assert.ok(labels.every((label) => label.id === footprint.id));
  if (cut.origin !== 'sentinel') { assert.equal(ruler, null); assert.equal(labels.length, 1); continue; }
  const value = cut.measurements.find((measurement) => measurement.transect_id === footprint.id);
  assert.deepEqual(ruler.current.point, value.point, 'Use saved measurement positions, not a point digitized on Esri');
  assert.equal(ruler.current.positionM, value.value);
  assert.equal(ruler.current.date, cut.datetime);
  assert.equal(ruler.changeM, value.change_m);
  assert.deepEqual(ruler.origin, footprint.origin);
  assert.ok(labels.every((label) => !['origin', 'front'].includes(label.kind)), 'Legacy frame/origin annotations stay off the map');
  if (ruler.changeM < 0) assert.ok(labels.find((label) => label.kind === 'current').change.includes('hacia tierra'));
  if (ruler.changeM > 0) assert.ok(labels.find((label) => label.kind === 'current').change.includes('hacia el mar'));
}
const missing = structuredClone(series.cuts.at(-1));
missing.measurements = [];
const missingRuler = littoralRuler(series, missing, selected);
assert.equal(missingRuler.current, null);
assert.equal(missingRuler.baseline, null);
assert.ok(!barMapLabels(selected, missingRuler).some((label) => ['current', 'baseline'].includes(label.kind)), 'Missing current data must not retain an old water marker');
const isolated = structuredClone(series.pilot.transects.features[0]);
const isolatedIndex = createTransectIndex([isolated]);
assert.equal(barFootprint(isolated, isolatedIndex).frontM, null, 'Never invent a front without neighbours');
assert.equal(JSON.stringify([series, datasets]), original, 'All source geometry and measurements remain unchanged');
const hashes = {};
for (const name of ['public/data/littoral/pilot-series.json', 'public/data/littoral/measurements.csv', ...['s2','l5','l8'].map((id) => 'public/data/problems/s34-' + id + '.geojson')]) hashes[name] = createHash('sha256').update(await readFile(new URL(name, root))).digest('hex');
const receipt = { checked_at: new Date().toISOString(), status: 'passed', checked_axes: checked, regional_axes: regional.features.length, pilot_axes: pilot.features.length, cuts: series.cuts.length, largest_partition_numerical_error_m: largestPartitionErrorM, example: { id: selected.id, reference_front_m: selected.frontM, drawn_axis_length_m: selected.axisLengthM, origin: selected.origin }, method: 'Midpoint display convention only; no scientific representativeness, cell limits, beach width, or erosion surface inferred', original_hashes: hashes };
await writeFile(new URL('docs/qa/bar-reference-2026-10-26.json', root), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
