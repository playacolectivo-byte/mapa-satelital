import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { fetchJsonAsset, getJson } from '../lib/data-delivery.ts';

// Exercise the production reader over real HTTP without external services or a
// browser. The wrapper below only records/reroutes this fixture's own requests.
const sourceJson = JSON.stringify({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature', id: 'costa-ñ-01',
    geometry: { type: 'LineString', coordinates: [[-89.74295081234567, 21.27500001234567], [-89.74295081234565, 21.27500001234568]] },
    properties: {
      displacement_m: -0.0000000123456789012345,
      uncertainty_m: 30.000000000000004,
      large_integer: Number.MAX_SAFE_INTEGER,
      year: 2011, capture_date: '2011-08-01',
      label: 'Erosión · costa, "fecha" y \\atribución',
      confirmed: false, missing: null, sources: ['Landsat', 'Esri / proveedor'],
    },
  }],
});
const expected = JSON.parse(sourceJson);
const compressed = gzipSync(Buffer.from(sourceJson));
const counts = new Map();
const waiters = new Map();
const headerWaiters = new Map();
const trace = [];
const sockets = new Set();
let activeFetches = 0;
let maximumFetches = 0;
let delayed503 = 0;
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://fixture.invalid').pathname;
  counts.set(path, (counts.get(path) ?? 0) + 1);
  waiters.get(path)?.shift()?.();
  const send = (status, body, headers = {}) => {
    response.writeHead(status, { 'Content-Length': body.length, ...headers });
    response.end(body);
  };
  if (path === '/raw.gz') return send(200, compressed, { 'Content-Type': 'application/gzip' });
  if (path === '/encoded.gz') return send(200, compressed, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
  if (path === '/plain.json') return send(200, Buffer.from(sourceJson), { 'Content-Type': 'application/json' });
  if (path === '/missing.gz') return send(404, Buffer.from('Missing compressed upload'));
  if (path === '/corrupt.gz') return send(200, Buffer.from('This is not a gzip stream'), { 'Content-Type': 'application/gzip' });
  if (path === '/busy.gz' || path === '/data/__compressed_fixture__/busy.json') {
    const timer = setTimeout(() => send(503, Buffer.from('Temporarily unavailable'), { 'Retry-After': '0' }), delayed503);
    response.once('close', () => clearTimeout(timer));
    return;
  }
  if (path === '/slow-headers.gz') {
    // Intentionally no headers/body. The test aborts after this request arrives.
    return;
  }
  if (path === '/slow-body.gz') {
    response.writeHead(200, { 'Content-Type': 'application/gzip', 'Content-Length': compressed.length });
    response.write(compressed.subarray(0, 12));
    return;
  }
  return send(404, Buffer.from('Unknown test path'));
});
server.on('connection', (socket) => {
  sockets.add(socket);
  socket.once('close', () => sockets.delete(socket));
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const origin = 'http://127.0.0.1:' + server.address().port;
const absolute = (path) => origin + path;
const originalFetch = globalThis.fetch;
const decompressionDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'DecompressionStream');
assert.equal(typeof DecompressionStream, 'function', 'This check requires Node with native streaming gzip support');
globalThis.fetch = async (input, init) => {
  const requested = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
  const url = new URL(requested, origin);
  assert.equal(url.origin, origin, 'The test must never contact another service');
  trace.push(url.pathname);
  activeFetches++;
  maximumFetches = Math.max(maximumFetches, activeFetches);
  try {
    const response = await originalFetch(url, init);
    headerWaiters.get(url.pathname)?.shift()?.();
    return response;
  }
  finally { activeFetches--; }
};
const signal = () => new AbortController().signal;
const count = (path) => counts.get(path) ?? 0;
const nextRequest = (path) => new Promise((resolve) => {
  const queue = waiters.get(path) ?? [];
  queue.push(resolve);
  waiters.set(path, queue);
});
const nextHeaders = (path) => new Promise((resolve) => {
  const queue = headerWaiters.get(path) ?? [];
  queue.push(resolve);
  headerWaiters.set(path, queue);
});
function unchanged(actual) {
  assert.deepEqual(actual, expected, 'Every coordinate, float, property and identifier must remain unchanged');
  assert.equal(JSON.stringify(actual), sourceJson, 'No rounding, field removal, reorder or text substitution');
  for (let i = 0; i < expected.features[0].geometry.coordinates.length; i++) {
    for (let axis = 0; axis < 2; axis++) {
      assert.ok(Object.is(actual.features[0].geometry.coordinates[i][axis], expected.features[0].geometry.coordinates[i][axis]));
    }
  }
}

try {
  await test('raw .gz without Content-Encoding is decompressed exactly once', async () => {
    const beforePlain = count('/plain.json');
    unchanged(await fetchJsonAsset(absolute('/plain.json'), signal(), absolute('/raw.gz')));
    assert.equal(count('/plain.json'), beforePlain, 'Successful compression must not also fetch plain JSON');
  });

  await test('Content-Encoding gzip uses Fetch automatic decompression without a second gzip pass', async () => {
    const beforePlain = count('/plain.json');
    unchanged(await fetchJsonAsset(absolute('/plain.json'), signal(), absolute('/encoded.gz')));
    assert.equal(count('/plain.json'), beforePlain);
  });

  await test('missing gzip upload falls back to one exact plain JSON response', async () => {
    const start = trace.length;
    unchanged(await fetchJsonAsset(absolute('/plain.json'), signal(), absolute('/missing.gz')));
    assert.deepEqual(trace.slice(start), ['/missing.gz', '/plain.json']);
  });

  await test('corrupt gzip falls back to plain JSON without altering any data', async () => {
    const start = trace.length;
    unchanged(await fetchJsonAsset(absolute('/plain.json'), signal(), absolute('/corrupt.gz')));
    assert.deepEqual(trace.slice(start), ['/corrupt.gz', '/plain.json']);
  });

  await test('browser without DecompressionStream requests plain JSON directly', async () => {
    const start = trace.length;
    Object.defineProperty(globalThis, 'DecompressionStream', { configurable: true, writable: true, value: undefined });
    try { unchanged(await fetchJsonAsset(absolute('/plain.json'), signal(), absolute('/raw.gz'))); }
    finally { Object.defineProperty(globalThis, 'DecompressionStream', decompressionDescriptor); }
    assert.deepEqual(trace.slice(start), ['/plain.json']);
  });

  await test('abort before gzip headers never starts a plain fallback', async () => {
    const controller = new AbortController(), arrived = nextRequest('/slow-headers.gz');
    const start = trace.length;
    const result = fetchJsonAsset(absolute('/plain.json'), controller.signal, absolute('/slow-headers.gz'));
    const rejected = assert.rejects(result, (error) => error.name === 'AbortError');
    await arrived;
    controller.abort();
    await rejected;
    assert.deepEqual(trace.slice(start), ['/slow-headers.gz']);
  });

  await test('abort while streaming gzip never starts a plain fallback', async () => {
    const controller = new AbortController(), arrived = nextHeaders('/slow-body.gz');
    const start = trace.length;
    const result = fetchJsonAsset(absolute('/plain.json'), controller.signal, absolute('/slow-body.gz'));
    const rejected = assert.rejects(result, (error) => error.name === 'AbortError');
    await arrived;
    // Wait until the response headers have actually reached Fetch, not merely
    // until the server saw the request. The body intentionally cannot finish.
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();
    await rejected;
    assert.deepEqual(trace.slice(start), ['/slow-body.gz']);
  });

  await test('HTTP 503 preserves the failure and does not add plain requests or retries', async () => {
    const start = trace.length;
    maximumFetches = 0;
    delayed503 = 25;
    const width = 3;
    const results = await Promise.allSettled(Array.from({ length: width }, () => fetchJsonAsset(absolute('/plain.json'), signal(), absolute('/busy.gz'))));
    delayed503 = 0;
    for (const result of results) {
      assert.equal(result.status, 'rejected');
      assert.equal(result.reason.status, 503);
      assert.equal(result.reason.retryAfter, '0');
    }
    assert.deepEqual(trace.slice(start), Array(width).fill('/busy.gz'));
    assert.equal(maximumFetches, width, 'Fallbacks must not increase caller-selected HTTP concurrency');
    assert.equal(activeFetches, 0);
  });

  await test('getJson retries a 503 only once, serially, and still reports failure', async () => {
    const start = trace.length;
    maximumFetches = 0;
    await assert.rejects(getJson('__compressed_fixture__/busy.json', signal()), (error) => error.status === 503);
    assert.deepEqual(trace.slice(start), ['/data/__compressed_fixture__/busy.json', '/data/__compressed_fixture__/busy.json']);
    assert.equal(maximumFetches, 1, 'A bounded retry must not create parallel replacements');
    assert.equal(activeFetches, 0);
  });
} finally {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, 'DecompressionStream', decompressionDescriptor);
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => server.close(resolve));
}
