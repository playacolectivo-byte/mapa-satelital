import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  mergePublishedTransects,
  selectPublishedPeriod,
  publishedValues,
  publishedPeriodForYear,
  researchSeries,
} from '../lib/problems.ts';

const datasets = await Promise.all(
  researchSeries.map(async ({ id }) =>
    JSON.parse(
      await readFile(
        new URL(
          '../public/data/problems/s34-' + id.toLowerCase() + '.geojson',
          import.meta.url,
        ),
        'utf8',
      ),
    ),
  ),
);
const original = JSON.stringify(datasets);
const inventory = mergePublishedTransects(datasets);
assert.equal(inventory.features.length, 9645);
assert.equal(new Set(inventory.features.map((f) => f.id)).size, 9645);
const sample = inventory.features.find(
  (f) => f.properties.idPol_Tran === 'P1_T455',
);
assert.ok(sample);
assert.deepEqual(publishedValues(sample, 'S2'), {
  rate: -1.45,
  category: 'Erosión Baja',
});
assert.deepEqual(publishedValues(sample, 'L5'), {
  rate: 1.01,
  category: 'Acreción Baja',
});
assert.deepEqual(publishedValues(sample, 'L8'), {
  rate: 5.09,
  category: 'Acreción Alta',
});
for (const { id, count } of researchSeries) {
  const period = selectPublishedPeriod(inventory, id);
  assert.equal(
    period.features.filter((f) => f.properties.category.startsWith('Erosión'))
      .length,
    count,
  );
  for (const feature of period.features) {
    const source = inventory.features.find((f) => f.id === feature.id);
    assert.equal(feature.geometry, source.geometry);
    assert.deepEqual(
      { rate: feature.properties.rate, category: feature.properties.category },
      publishedValues(source, id),
    );
  }
  assert.equal(
    period.features.find((f) => f.properties.idPol_Tran === 'P1_T455').id,
    sample.id,
  );
}
const missing = {
  ...sample,
  properties: { ...sample.properties, LRR_S2: null },
};
assert.equal(publishedValues(missing, 'S2'), null);
assert.equal(
  selectPublishedPeriod(
    { type: 'FeatureCollection', features: [missing] },
    'S2',
  ).features.length,
  0,
);
assert.equal(publishedPeriodForYear(null), null);
assert.equal(publishedPeriodForYear(1985), null);
assert.deepEqual(publishedPeriodForYear(2011), {
  series: 'L5',
  containsYear: true,
});
assert.deepEqual(publishedPeriodForYear(2012), {
  series: 'L5',
  containsYear: false,
});
assert.deepEqual(publishedPeriodForYear(2015), {
  series: 'L8',
  containsYear: true,
});
assert.deepEqual(publishedPeriodForYear(2019), {
  series: 'S2',
  containsYear: true,
});
assert.deepEqual(publishedPeriodForYear(2025), {
  series: 'S2',
  containsYear: false,
});
const conflicting = structuredClone(sample);
conflicting.properties.LRR_S2 = 999;
assert.throws(
  () =>
    mergePublishedTransects([
      { type: 'FeatureCollection', features: [sample, conflicting] },
    ]),
  /Conflicting published value/,
);
conflicting.properties.LRR_S2 = sample.properties.LRR_S2;
conflicting.geometry.coordinates[0][0] += 0.001;
assert.throws(
  () =>
    mergePublishedTransects([
      { type: 'FeatureCollection', features: [sample, conflicting] },
    ]),
  /Conflicting transect geometry/,
);
assert.equal(
  JSON.stringify(datasets),
  original,
  'Received source collections must not be mutated',
);
console.log(
  'Erosion history: 9,645 unchanged transects, published classes/rates, missing values, conflict rejection and dated period selection verified.',
);
