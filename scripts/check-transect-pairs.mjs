import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { mergePublishedTransects, researchSeries, selectPublishedPeriod } from '../lib/problems.ts';
import { createTransectPairIndex, transectSpan, wgs84DistanceM } from '../lib/transect-pairs.ts';
import { littoralPairPoints, validateLittoralSeries } from '../lib/littoral-series.ts';

const root = new URL('../', import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const series = validateLittoralSeries(await readJson('public/data/littoral/pilot-series.json'));
const datasets = await Promise.all(['s2', 'l5', 'l8'].map((mission) => readJson('public/data/problems/s34-' + mission + '.geojson')));
const pilot = createTransectPairIndex(series.pilot.transects.features);
const inventory = mergePublishedTransects(datasets);
const regional = createTransectPairIndex(inventory.features);
const before = JSON.stringify([series, datasets]);
assert.equal(pilot.pairs.length, 10);
assert.equal(pilot.byBar.size, 11);
assert.equal(regional.pairs.length, 9619);
assert.equal(regional.byBar.size, inventory.features.length, 'Every original bar has a neighbouring pair');
assert.equal(pilot.byBar.get('P16_T520').id, 'P16_T517--P16_T520', 'Last bar pairs backward, not across groups');
for (const index of [pilot, regional]) {
  for (const pair of index.pairs) {
    assert.equal(pair.a.properties.idPol_Tran.split('_')[0], pair.b.properties.idPol_Tran.split('_')[0]);
    const span = transectSpan(pair);
    assert.ok(span.distanceM > 0 && Number.isFinite(span.distanceM));
    assert.equal(span.bars.features[0], pair.a, 'Keep exact axis objects');
    assert.equal(span.bars.features[1], pair.b);
    assert.equal(span.area.geometry.coordinates[0].length, pair.a.geometry.coordinates.length + pair.b.geometry.coordinates.length + 1);
    const reversed = { ...pair, b: { ...pair.b, geometry: { ...pair.b.geometry, coordinates: [...pair.b.geometry.coordinates].reverse() } } };
    assert.ok(Math.abs(transectSpan(reversed).distanceM - span.distanceM) < .000001, 'Axis direction must not change separation');
    const next = index.next.get(pair.id), previous = index.previous.get(pair.id);
    if (next) { assert.equal(next.a, pair.b); assert.equal(index.previous.get(next.id), pair); }
    if (previous) assert.equal(index.next.get(previous.id), pair);
  }
}
for (const cut of series.cuts) for (const pair of pilot.pairs) {
  const points = littoralPairPoints(cut, pair);
  assert.equal(points.length, 3, 'Maximum three clear points per pair');
  assert.ok(points[2].text.includes(cut.origin === 'alec' ? cut.period_label : new Date(cut.datetime).getUTCFullYear()));
  if (cut.origin === 'alec') assert.ok(points[0].text.includes('m/año'));
  else assert.ok(points[0].text.includes('origen fijo'));
}
const chosen = pilot.byBar.get('P16_T499');
const latest = structuredClone(series.cuts.at(-1));
latest.measurements = latest.measurements.filter((m) => m.transect_id !== chosen.b.properties.idPol_Tran);
assert.ok(!littoralPairPoints(latest, chosen)[0].text.includes('Sin dato'));
assert.ok(littoralPairPoints(latest, chosen)[1].text.includes('Sin dato'));
latest.measurements = [];
assert.ok(littoralPairPoints(latest, chosen).slice(0, 2).every((point) => point.text.includes('Sin dato')));
assert.notDeepEqual(littoralPairPoints(series.cuts[3], chosen), littoralPairPoints(series.cuts.at(-1), chosen));
for (const { id } of researchSeries) {
  const period = selectPublishedPeriod(inventory, id);
  for (const feature of period.features) assert.ok(regional.byBar.has(feature.properties.idPol_Tran), 'Every dated bar resolves against the fixed inventory, not a new date-dependent neighbourhood');
}
assert.equal(JSON.stringify([series, datasets]), before, 'Geometry, observations, dates, and rates stay untouched');
assert.equal(wgs84DistanceM([-89.7, 21.27], [-89.7, 21.27]), 0);
const geodesy = await readJson('docs/qa/transect-pairs-geodesy-2026-10-26.json');
for (const item of geodesy.cases) assert.ok(Math.abs(wgs84DistanceM(item.a, item.b) - item.geographiclib_wgs84_m) < .001, 'Independent WGS84 validation to under 1 mm (numerical agreement, not source accuracy)');
const files = ['public/data/littoral/pilot-series.json', 'public/data/littoral/measurements.csv', ...['s2','l5','l8'].map((id) => 'public/data/problems/s34-' + id + '.geojson')];
const sha256 = {};
for (const name of files) sha256[name] = createHash('sha256').update(await readFile(new URL(name, root))).digest('hex');
const receipt = { checked_at: new Date().toISOString(), pilot_bars: 11, pilot_spans: 10, regional_bars: inventory.features.length, regional_spans: regional.pairs.length, cuts: series.cuts.length, numeric_geodesy_cases: geodesy.cases.length, measured_variable: 'Geodesic separation between the original axis centres; not shoreline recession, beach width, or a continuous interior measurement', source_sha256: sha256, status: 'passed' };
await writeFile(new URL('docs/qa/transect-pairs-2026-10-26.json', root), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
