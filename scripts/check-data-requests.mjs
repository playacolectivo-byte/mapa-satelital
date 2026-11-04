import assert from 'node:assert/strict';
import { getJson, dataAssetUrl } from '../lib/data-delivery.ts';

const originalFetch = globalThis.fetch;
try {
  assert.match(dataAssetUrl('config.json'), /^\/data\/runtime\/[a-f0-9]{64}\.json$/);
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1
    ? new Response('Temporarily busy', { status: 503 })
    : Response.json({ recovered: true });
  assert.deepEqual(await getJson('config.json', new AbortController().signal), { recovered: true });
  assert.equal(calls, 2, 'Temporary overload should recover with one retry');

  calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('Not found', { status: 404 }); };
  await assert.rejects(getJson('config.json', new AbortController().signal));
  assert.equal(calls, 1, 'A missing version must not create a retry storm');

  calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('Busy', { status: 503 }); };
  await assert.rejects(getJson('config.json', new AbortController().signal));
  assert.equal(calls, 2, 'Persistent overload must stop');

  calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('broken JSON', { status: 200 }); };
  await assert.rejects(getJson('config.json', new AbortController().signal), SyntaxError);
  assert.equal(calls, 1, 'Corrupt content must not be accepted or retried forever');

  calls = 0;
  globalThis.fetch = async (_url, { signal }) => {
    calls++;
    return new Promise((_resolve, reject) => {
      if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  };
  await assert.rejects(getJson('config.json', AbortSignal.timeout(20)), { name: 'AbortError' });
  assert.equal(calls, 1, 'Cancelled requests must stop without retrying');
  console.log('Data requests: overload recovery, retry limits, 404, invalid JSON and cancellation verified.');
} finally { globalThis.fetch = originalFetch; }
