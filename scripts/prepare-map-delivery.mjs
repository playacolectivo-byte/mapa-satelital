import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergePublishedTransects, publishedValues, researchSeries } from '../lib/problems.ts';
import { exportCoastalEvolution } from './export-coastal-evolution.mjs';
import { exportAnchoredEvolution } from './export-anchored-evolution.mjs';
import { exportFixed1993Evolution } from './export-fixed-1993-evolution.mjs';
import { prepareCoastalMap } from './prepare-coastal-map.mjs';
import { prepareMangroveMap } from './prepare-mangrove-map.mjs';
import { gzipSync, gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import './prepare-style-sources.mjs';

await exportCoastalEvolution();
await exportAnchoredEvolution();
await exportFixed1993Evolution();
const coastalDelivery=await prepareCoastalMap();
const mangroveDelivery=await prepareMangroveMap();

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = resolve(root, 'public/data/runtime');
const paths = [
  'config.json', 'sources.json', 'context.geojson', 'localities.geojson',
  'coast.geojson', 'mangrove.geojson', 'wetlands.geojson', 'water.geojson',
  'problems/temporal-observations.json', 'problems/structure-outlines.geojson',
  'problems/geotube-historical-axes.geojson', 'problems/disturbed-mangrove-2020.geojson',
  'problems/gmw/manifest.json', 'problems/gmw/annual-changes.geojson',
  'problems/structures-yucatan.geojson', 'sentinel/manifest.json',
  'littoral/pilot-series.json',
  'littoral/coastal-evolution.json',
  'historical-background/manifest.json',
  'history/manifest.json',
  'history/landsat-tiles.json',
  'history/nasa-gweld.json',
  'history/geomedian.json',
  'history/coverage-reviews.json',
  'littoral/alec-trend-models.json',
  'coastal-places.json',
  'shorelines/annual/manifest.json',
  'shorelines/reference-2010/manifest.json',
  ...(coastalDelivery.some(layer=>layer.source.startsWith('series-2015/'))?['shorelines/series-2015/manifest.json','shorelines/series-2015/coverage-index.geojson','shorelines/series-2015/coverage-years.json','shorelines/series-2015/reference-coast-2025.geojson']:[]),
  'road-kilometres.geojson',
  ...coastalDelivery.map(layer=>'shorelines/map/'+layer.source.replace(/\.geojson$/,'.json')),
  ...mangroveDelivery.paths,
];
const hash = (value) => createHash('sha256').update(value).digest('hex');
const assets = {};
await mkdir(directory, { recursive: true });
await mkdir(resolve(root, 'lib/generated'), { recursive: true });
async function asset(path, bytes, sources = []) {
  const sha256 = hash(bytes);
  const url = '/data/runtime/' + sha256 + '.json';
  await writeFile(resolve(root, 'public' + url), bytes);
  const packed=gzipSync(bytes,{level:9});assert.deepEqual(gunzipSync(packed),bytes);
  const gzip_url=url+'.gz';await writeFile(resolve(root,'public'+gzip_url),packed);
  assets[path] = { url, gzip_url, sha256, bytes: bytes.length, gzip_bytes:packed.length, sources };
}
for (const path of paths) {
  // Byte-for-byte copies. Received scientific files are never rewritten.
  const bytes = await readFile(resolve(root, 'public/data', path));
  await asset(path, bytes, [{ path, sha256: hash(bytes), bytes: bytes.length }]);
}
const sources = await Promise.all(researchSeries.map(async ({ id }) => {
  const path = 'problems/s34-' + id.toLowerCase() + '.geojson';
  const bytes = await readFile(resolve(root, 'public/data', path));
  return { path, bytes, data: JSON.parse(bytes.toString()) };
}));
const inventory = mergePublishedTransects(sources.map((source) => source.data));
const compact = {
  type: 'FeatureCollection',
  features: inventory.features.map((feature) => ({
    type: 'Feature', id: feature.id, geometry: feature.geometry,
    properties: Object.fromEntries([
      ['source_id', 'S34'], ['idPol_Tran', feature.properties.idPol_Tran],
      ...researchSeries.flatMap(({ id }) => [
        ['LRR_' + id, feature.properties['LRR_' + id]],
        ['ClasVul' + id, feature.properties['ClasVul' + id]],
      ]),
    ]),
  })),
};
// Reject any change to the published coordinates, rates, classes or identities.
compact.features.forEach((feature, index) => {
  const before = inventory.features[index];
  if (JSON.stringify(feature.geometry) !== JSON.stringify(before.geometry) || feature.id !== before.id)
    throw new Error('Source geometry or ID changed');
  for (const { id } of researchSeries)
    if (JSON.stringify(publishedValues(feature, id)) !== JSON.stringify(publishedValues(before, id)))
      throw new Error('Published value changed');
});
const compactBytes = Buffer.from(JSON.stringify(compact));
await asset('problems/s34-inventory.geojson', compactBytes, sources.map((s) => ({
  path: s.path, sha256: hash(s.bytes), bytes: s.bytes.length,
})));
await writeFile(resolve(root, 'lib/generated/data-assets.json'), JSON.stringify({ version: 1, assets }, null, 2) + '\n');
console.log(JSON.stringify({
  assets: Object.keys(assets).length,
  erosion_records: compact.features.length,
  erosion_original_bytes: sources.reduce((n, s) => n + s.bytes.length, 0),
  erosion_delivery_bytes: compactBytes.length,
}));
