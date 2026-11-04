import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { calendarYears, datedChoiceForYear, stepTimelineIndex, IMAGERY_FIRST_YEAR } from '../lib/calendar-time.ts';
import { validateLittoralSeries, littoralYearBounds, littoralCutForYear, littoralMapData } from '../lib/littoral-series.ts';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const series = validateLittoralSeries(JSON.parse(await read('public/data/littoral/pilot-series.json')));
const unchanged = JSON.stringify(series);
const { firstYear, lastYear } = littoralYearBounds(series, 2026);
const years = calendarYears(firstYear, lastYear);
assert.equal(firstYear, 1986); assert.equal(lastYear, 2026); assert.equal(years.length, 41);
for (let i = 1; i < years.length; i++) assert.equal(years[i] - years[i - 1], 1);
const walk = (from, target, count) => {
  const visited = [from];
  while (from !== target) {
    const next = stepTimelineIndex(from, target, count);
    assert.equal(Math.abs(next - from), 1);
    visited.push(next); from = next;
    assert.ok(visited.length <= count);
  }
  return visited;
};
assert.deepEqual(walk(0, 40, 41).map((i) => years[i]), years);
assert.deepEqual(walk(40, 0, 41).map((i) => years[i]), years.toReversed());
assert.equal(stepTimelineIndex(40, 100, 41), 40);
assert.equal(stepTimelineIndex(0, -100, 41), 0);
assert.equal(stepTimelineIndex(0, 100, 1), 0);
const cuts = years.map((year) => ({ year, cut: littoralCutForYear(series, year) }));
for (const { year, cut } of cuts) {
  if (cut.origin === 'sentinel') assert.equal(Number(cut.datetime.slice(0, 4)), year);
  if (cut.origin === 'alec') {
    assert.equal(cut.unit, 'm/year'); assert.equal(cut.datetime, null);
    assert.ok(series.cuts.includes(cut), 'Historical interval remains the original received record');
  }
}
const gap = littoralCutForYear(series, 2012);
assert.equal(gap.origin, 'gap'); assert.deepEqual(gap.measurements, []);
assert.ok(littoralMapData(series, gap).features.every((line) => line.properties.no_data));
const absent = structuredClone(series); absent.cuts = absent.cuts.filter((cut) => !cut.datetime?.startsWith('2022'));
assert.equal(littoralCutForYear(absent, 2022).origin, 'gap', 'A missing year remains selectable without reusing another year’s measurement');
assert.equal(littoralCutForYear(series, 2023).datetime.slice(0, 10), '2023-10-26');
assert.equal(littoralCutForYear(series, 2024).datetime.slice(0, 10), '2024-11-29');
assert.equal(series.cuts.filter((cut) => cut.datetime?.startsWith('2023')).length, 2, 'Both original dates remain available for explicit consultation');

const catalogue = JSON.parse(await read('public/data/history/wayback-chelem.json'));
const images = catalogue.releases.toSorted((a, b) => a.item.releaseDateLabel.localeCompare(b.item.releaseDateLabel));
const capture = (value) => new Date(value.meta.date).toISOString().slice(0, 10);
assert.equal(Math.min(...images.map((entry) => Number(capture(entry).slice(0, 4)))), IMAGERY_FIRST_YEAR);
const mapping = calendarYears(IMAGERY_FIRST_YEAR, 2026).map((year) => {
  const image = datedChoiceForYear(images, year, capture);
  if(image)assert.equal(Number(capture(image).slice(0,4)),year);
  return { year, capture: image?capture(image):null, release: image?.item.releaseNum??null, omitted:!image };
});
assert.equal(mapping.find((entry) => entry.year === 2022).capture, '2022-09-25');
assert.equal(mapping.at(-1).year,2026);assert.equal(mapping.at(-1).capture,null,'2025 must never replace a missing2026 image');
assert.equal(datedChoiceForYear([], 2026, capture), null);
const reversed = images.toReversed();
assert.equal(capture(datedChoiceForYear(reversed, 2023, capture)), '2023-09-21');
assert.equal(JSON.stringify(series), unchanged);
for (const [file, expected] of Object.entries({
  'public/data/littoral/pilot-series.json': 'e1669cd3249797b4f1f4dfada0947b8ab32596043f83e93fff46caa8f7a35a09',
  'public/data/littoral/measurements.csv': 'bb0dd9cd67eb0123e9da5206b50075b8d4c097e0a5edecc08d04674ee3ab8d1f',
})) assert.equal(createHash('sha256').update(await read(file)).digest('hex'), expected);

const receipt = { checked_at: new Date().toISOString(), status: 'passed', scope: 'Navigation and the unchanged original pilot interval series. Main measured coverage is in coastal-evolution-2026-10-27.json.', annual_stops: years.length, first_year: firstYear, last_year: lastYear, original_pilot_interval_gap_years: cuts.filter((entry) => entry.cut.origin === 'gap').map((entry) => entry.year), checks: ['every calendar year in both directions', 'bounded exact endpoints', 'adjacent steps for a full-range jump', 'latest real observation per year, extra dates retained', 'historical interval rates unchanged', 'missing measurements are not invented', 'acquisition dates independent of edition/year selection', 'JSON and CSV source hashes unchanged'], esri_received_catalogue_mapping: mapping };
await writeFile(new URL('docs/qa/calendar-timeline-2026-10-27.json', root), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
