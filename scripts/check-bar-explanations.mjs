import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { barFootprint, createTransectIndex } from '../lib/transect-pairs.ts';
import { barMapLabels, littoralRuler, shortLittoralDate, validateLittoralSeries } from '../lib/littoral-series.ts';

const root = new URL('../', import.meta.url);
const series = validateLittoralSeries(JSON.parse(await readFile(new URL('public/data/littoral/pilot-series.json', root), 'utf8')));
const index = createTransectIndex(series.pilot.transects.features);
const untouched = JSON.stringify(series);
let explanations = 0, observations = 0;
for (const cut of series.cuts) for (const feature of index.features) {
  const footprint = barFootprint(feature, index);
  const ruler = littoralRuler(series, cut, footprint);
  const labels = barMapLabels(footprint, ruler, cut);
  for (const label of labels) {
    explanations++;
    assert.equal(label.explanation.points.length, 1);
    assert.equal(label.explanation.cutId, cut.id);
    assert.equal(label.id, footprint.id);
    assert.ok(label.explanation.technical.includes(footprint.id));
  }
  assert.ok(labels.every((label) => !['front', 'origin'].includes(label.kind)), 'No front or zero-origin annotations in the map');
  const current = labels.find((label) => label.kind === 'current');
  const baseline = labels.find((label) => label.kind === 'baseline');
  if (cut.origin === 'alec') {
    assert.equal(labels.length, 1, 'Historical rates must not gain invented annual water positions');
    assert.equal(labels[0].explanation.sourceUrl, cut.source_url);
    assert.ok(labels[0].explanation.technical.includes(cut.period_label));
    continue;
  }
  if (!current) continue;
  observations++;
  assert.ok(current.explanation.title.includes(shortLittoralDate(cut.datetime)));
  assert.ok(current.explanation.technical.includes(cut.product.id));
  assert.equal(current.explanation.sourceUrl, cut.product.metadata_url);
  assert.ok(current.explanation.technical.includes(String(ruler.current.positionM)), 'Absolute position retained in technical details');
  assert.ok(current.explanation.technical.includes('no confirma pérdida'));
  if (ruler.changeM === 0) assert.ok(current.explanation.points[0].text.includes('no prueba'));
  if (baseline) {
    const source = series.cuts.find((entry) => entry.id === cut.baseline_observation_id);
    assert.equal(baseline.explanation.sourceUrl, source.product.metadata_url, 'Reference-point link must use the baseline product, not the selected product');
    assert.ok(baseline.explanation.title.includes(shortLittoralDate(source.datetime)));
    assert.ok(baseline.explanation.technical.includes(source.product.id));
  }
}
const footprint = barFootprint(index.byId.get('P16_T499'), index);
const missing = structuredClone(series.cuts.at(-1)); missing.measurements = [];
const absent = barMapLabels(footprint, littoralRuler(series, missing, footprint), missing);
assert.deepEqual(absent, [], 'No old water annotation when the current measurement is missing');
const earlier = series.cuts.find((cut) => cut.datetime?.startsWith('2023-10-21'));
const recent = series.cuts.at(-1);
const help = (cut) => barMapLabels(footprint, littoralRuler(series, cut, footprint), cut).find((label) => label.kind === 'current');
assert.notEqual(help(earlier).explanation.title, help(recent).explanation.title);
assert.notEqual(help(earlier).explanation.points[0].text, help(recent).explanation.points[0].text);
assert.notEqual(help(earlier).explanation.sourceUrl, help(recent).explanation.sourceUrl);
assert.equal(JSON.stringify(series), untouched);
const expected = {
  'public/data/littoral/pilot-series.json': 'e1669cd3249797b4f1f4dfada0947b8ab32596043f83e93fff46caa8f7a35a09',
  'public/data/littoral/measurements.csv': 'bb0dd9cd67eb0123e9da5206b50075b8d4c097e0a5edecc08d04674ee3ab8d1f',
  'public/data/problems/s34-s2.geojson': '7f3ed501d1e18cef6f5bd6abd20cfe0e3d97356e4ace0b053d54fa7fc819227b',
  'public/data/problems/s34-l5.geojson': '22cf69832b246c523674dfb46df36ca2e19903d09f152d67298648cdf76882df',
  'public/data/problems/s34-l8.geojson': '1589366bfab195196b3e1740a16970cdff7282069b94e4f147c122f0cac20f8a',
};
for (const [path, hash] of Object.entries(expected)) assert.equal(createHash('sha256').update(await readFile(new URL(path, root))).digest('hex'), hash, 'Original unchanged: ' + path);
const receipt = { checked_at: new Date().toISOString(), status: 'passed', axes: index.features.length, cuts: series.cuts.length, explanations, recent_positions: observations, checks: ['exactly one point per marker', 'actual dates, values and product links', 'baseline has its own product link', 'selected-date explanation changes with its record', 'historical rates have no invented water point', 'missing measurement is not stability', 'all five source hashes unchanged'] };
await writeFile(new URL('docs/qa/bar-explanations-endpoints-2026-10-26.json', root), JSON.stringify({ ...receipt, checks: [...receipt.checks, 'no front/zero annotations'], browser_limit: 'See separate current browser walkthrough receipt; prior browser outage is not reused as a result of this update.' }, null, 2) + '\n');
console.log(JSON.stringify(receipt));
