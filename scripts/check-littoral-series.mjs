import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateLittoralSeries, littoralCut, littoralMapData, littoralAxisData, littoralMeasurement, littoralPoints } from '../lib/littoral-series.ts';

const series = validateLittoralSeries(JSON.parse(await readFile(new URL('../public/data/littoral/pilot-series.json', import.meta.url), 'utf8')));
const originals = new Map(series.pilot.transects.features.map((feature) => [feature.properties.idPol_Tran, feature]));
const published = new Map();
for (const mission of ['l5', 'l8', 's2']) for (const feature of JSON.parse(await readFile(new URL('../public/data/problems/s34-' + mission + '.geojson', import.meta.url), 'utf8')).features) published.set(feature.properties.idPol_Tran, feature);
for (const [id, feature] of originals) {
  assert.ok(published.has(id));
  assert.deepEqual(feature.geometry, published.get(id).geometry, 'The map retains the exact original authors’ axes');
}
const historical = series.cuts.filter((cut) => cut.origin === 'alec');
const recent = series.cuts.filter((cut) => cut.origin === 'sentinel');
assert.ok(historical.length && recent.length >= 2, 'The pilot must contain actual historical and recent records');
for (const cut of historical) {
  const mission = cut.start.startsWith('1986') ? 'L5' : cut.start.startsWith('2013') ? 'L8' : cut.start.startsWith('2016') ? 'S2' : null;
  assert.ok(mission, 'Only the three verified published periods are accepted');
  assert.equal(cut.datetime, null);
  for (const measurement of cut.measurements) assert.equal(measurement.value, published.get(measurement.transect_id).properties['LRR_' + mission] ?? null, 'Published rates must be preserved exactly, never interpolated');
}
for (const cut of series.cuts) {
  const data = littoralAxisData(series, cut);
  assert.equal(data.features.length, originals.size, 'Missing measurements retain their axes as no-data');
  for (const feature of data.features) assert.deepEqual(feature.geometry, originals.get(feature.properties.transect_id).geometry);
  const id = [...originals.keys()][0];
  assert.equal(littoralPoints(cut, id).length, 3);
  if (cut.origin === 'alec') assert.ok(littoralPoints(cut, id).some((point) => point.text.includes('m/año')));
    if (cut.origin === 'sentinel') assert.ok(littoralPoints(cut, id).some((point) => /marea.*(sin corregir|pendiente)/i.test(point.text)));
}
const selected = [...originals.keys()][0];
for (const cut of recent) {
  assert.equal(littoralCut(series, cut.id), cut);
  assert.equal(littoralMeasurement(cut, selected)?.transect_id ?? selected, selected);
}
// Changing a cut recomputes the same selected entity’s content rather than retaining old values.
const first = recent[0], last = recent.at(-1);
assert.notEqual(first.id, last.id);
assert.notDeepEqual(littoralPoints(first, selected), littoralPoints(last, selected));
assert.ok(littoralPoints(last, selected).some((point) => point.text.includes('Sentinel-2')));

const missing = structuredClone(last);
missing.measurements = [];
assert.ok(littoralAxisData(series, missing).features.every((feature) => feature.properties.no_data));
assert.equal(littoralMapData(series, missing).features.length, 0, 'No invented change line where measurements are absent');
assert.ok(littoralPoints(missing, selected).some((point) => point.text.includes('Sin dato')));
assert.equal(littoralMeasurement(missing, selected), null);

const duplicate = structuredClone(series);
duplicate.cuts.push(duplicate.cuts[0]);
assert.throws(() => validateLittoralSeries(duplicate));
const orphan = structuredClone(series);
orphan.cuts[0].measurements[0].transect_id = 'NON_EXISTENT';
assert.throws(() => validateLittoralSeries(orphan));
const mixed = structuredClone(series);
mixed.cuts.find((cut) => cut.origin === 'sentinel').unit = 'm/year';
assert.throws(() => validateLittoralSeries(mixed));
const invented = structuredClone(series);
invented.cuts.find((cut) => cut.origin === 'alec').datetime = '2021-01-01';
assert.throws(() => validateLittoralSeries(invented));
const zeroGap = structuredClone(series);
zeroGap.cuts[0].measurements[0] = { transect_id: selected, value: 0, change_m: 0, point: null, quality: 'no_data' };
assert.throws(() => validateLittoralSeries(zeroGap));
console.log(JSON.stringify({ checked_cuts: series.cuts.length, historical_periods: historical.length, recent_observations: recent.length, original_axes: originals.size, checks: 'geometry, original rates, mixed units, date precision, selection refresh, no-data, unique IDs and references' }));
