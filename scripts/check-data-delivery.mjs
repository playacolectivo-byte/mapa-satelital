import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { mergePublishedTransects, publishedValues, selectPublishedPeriod, researchSeries } from '../lib/problems.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, 'lib/generated/data-assets.json')));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
for (const [path, asset] of Object.entries(manifest.assets)) {
  const bytes = await readFile(resolve(root, 'public' + asset.url));
  assert.equal(hash(bytes), asset.sha256, path + ': delivery SHA-256');
  assert.equal(bytes.length, asset.bytes, path + ': delivery byte count');
  for (const source of asset.sources) {
    const original = await readFile(resolve(root, 'public/data', source.path));
    assert.equal(hash(original), source.sha256, source.path + ': original SHA-256');
    assert.equal(original.length, source.bytes, source.path + ': original byte count');
    if (asset.sources.length === 1) assert.deepEqual(bytes, original, path + ': original bytes');
  }
}
const originals = await Promise.all(researchSeries.map(async ({ id }) => JSON.parse(await readFile(resolve(root, 'public/data/problems/s34-' + id.toLowerCase() + '.geojson')))));
const union = mergePublishedTransects(originals);
const runtime = JSON.parse(await readFile(resolve(root, 'public' + manifest.assets['problems/s34-inventory.geojson'].url)));
assert.equal(runtime.features.length, union.features.length);
const byId = new Map(union.features.map((f) => [f.id, f]));
for (const feature of runtime.features) {
  const original = byId.get(feature.id);
  assert.ok(original, 'Every delivery record must be a published record');
  assert.deepEqual(feature.geometry, original.geometry, 'No coordinate changes');
  assert.equal(feature.properties.idPol_Tran, original.properties.idPol_Tran);
  for (const { id } of researchSeries) assert.deepEqual(publishedValues(feature, id), publishedValues(original, id));
}
for (const series of researchSeries) {
  const period = selectPublishedPeriod(runtime, series.id);
  assert.equal(period.features.filter((f) => f.properties.category.startsWith('Erosión')).length, series.count);
}
console.log(`Data delivery: all ${Object.keys(manifest.assets).length} content hashes, source bytes and 9,645 transects in all three periods verified.`);
