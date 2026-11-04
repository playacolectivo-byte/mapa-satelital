import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const root = fileURLToPath(new URL('../', import.meta.url));
// Reuse the exact runtime already pinned by Wrangler. No dependency additions.
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler'));
const { Miniflare, Log, LogLevel } = await import(pathToFileURL(wranglerRequire.resolve('miniflare')).href);
const argument=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const directory = resolve(root, argument('--directory','dist/public-map'));
const html = await readFile(resolve(directory, 'index.html'));
const manifest = JSON.parse(await readFile(resolve(root, 'lib/generated/data-assets.json')));
const codeUrls=[...html.toString().matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map((match) => match[1]);
const representative=process.argv.includes('--representative');
const requestedData=representative?['config.json','sources.json','context.geojson','localities.geojson','coast.geojson','mangrove.geojson','wetlands.geojson','water.geojson','coastal-places.json','problems/s34-inventory.geojson','problems/structure-outlines.geojson','history/manifest.json'].map(path=>manifest.assets[path]).filter(Boolean).map(asset=>asset.gzip_url??asset.url):Object.values(manifest.assets).map(asset=>asset.url);
const urls = ['/', ...codeUrls, ...requestedData,...(representative?['/data/shorelines/scenario/model.json.gz','/data/shorelines/photo-alignment/revised-data.json.gz','/data/shorelines/photo-alignment/position-method.md']:[])];
const expected = new Map(await Promise.all(urls.map(async (url) => [url, createHash('sha256').update(url === '/' ? html : await readFile(resolve(directory, '.' + url))).digest('hex')])));
const mf = new Miniflare({
  host: '127.0.0.1', port: 0, inspectorPort: 0,
  modules: true,
  script: 'export default { fetch() { throw new Error("Static map unexpectedly invoked application compute"); } };',
  compatibilityDate: '2026-05-15',
  assets: { directory, routerConfig: { has_user_worker: false }, assetConfig: { not_found_handling: '404-page' } },
  log: new Log(LogLevel.ERROR),
});
let requests = 0, bytes = 0;
const durations = [];
async function read(url) {
  const start = performance.now();
  const response = await mf.dispatchFetch('http://map.test' + url);
  assert.equal(response.status, 200, url);
  if (url.startsWith('/data/runtime/') || url.startsWith('/assets/'))
    assert.match(response.headers.get('cache-control'), /max-age=31536000.*immutable/);
  else assert.match(response.headers.get('cache-control'), /must-revalidate/);
  const digest = createHash('sha256');
  // Consume streams without buffering a whole dataset per virtual visitor.
  for await (const part of response.body) { digest.update(part); bytes += part.length; }
  assert.equal(digest.digest('hex'), expected.get(url), url + ': exact body');
  requests++;
  durations.push(performance.now() - start);
}
try {
  await mf.ready;
  const first = await mf.dispatchFetch('http://map.test' + urls[urls.length - 1]);
  const etag = first.headers.get('etag');
  await first.body.cancel();
  assert.ok(etag);
  const unchanged = await mf.dispatchFetch('http://map.test' + urls[urls.length - 1], { headers: { 'if-none-match': etag } });
  assert.equal(unchanged.status, 304, 'Unchanged data must not be downloaded again');
  assert.equal((await mf.dispatchFetch('http://map.test/data/runtime/missing.json')).status, 404, 'Missing JSON must not become an HTML success page');
  assert.equal((await mf.dispatchFetch('http://map.test/_headers')).status, 404, 'Header policy is not a public asset');
  const started = performance.now();
  const concurrency = 50;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (const url of urls) await read(url);
  }));
  const elapsed = performance.now() - started;
  durations.sort((a, b) => a - b);
  const result = {
    environment: 'Local Cloudflare asset runtime (Miniflare). Not a live-CDN or imagery-provider benchmark.',
    concurrent_virtual_visitors: concurrency,
    requests_per_visitor: urls.length,
    successful_requests: requests,
    failed_requests: 0,
    transferred_bytes: bytes,
    elapsed_ms: Math.round(elapsed),
    request_p50_ms: Math.round(durations[Math.floor(durations.length * 0.5)]),
    request_p95_ms: Math.round(durations[Math.floor(durations.length * 0.95)]),
    content_hashes_verified: true,
    browser_cache_headers_verified: true,
    etag_revalidation_304_verified: true,
    missing_data_404_verified: true,
    application_compute_used: false,
    external_imagery_requests: 0,
    checked_at_utc: new Date().toISOString(),
  };
  await mkdir(resolve(root, 'docs/qa'), { recursive: true });
  await writeFile(resolve(root, argument('--report','docs/qa/public-capacity-' + new Date().toISOString().slice(0, 10) + '.json')), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { await mf.dispose(); }
