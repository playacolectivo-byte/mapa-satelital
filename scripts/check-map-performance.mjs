import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  TimelineCache,
  captureMetadataKey,
  readWithDeadline,
} from '../lib/timeline-cache.ts';
import {
  batchTransects,
  batchOutlines,
  nearestTransect,
} from '../lib/map-display.ts';
import { createTemporalEvidenceResolver } from '../lib/temporal-evidence.ts';
import { RasterFrameCache } from '../lib/raster-frame-cache.ts';

const json = async (path) =>
  JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const cache = new TimelineCache(2);
let requests = 0,
  finish;
const first = cache.load('one', () => {
  requests++;
  return new Promise((resolve) => {
    finish = resolve;
  });
});
const duplicate = cache.load('one', () => {
  throw new Error('duplicate request');
});
await Promise.resolve();
finish({ date: 100 });
assert.equal(await first, await duplicate);
assert.equal(requests, 1);
assert.equal(
  (
    await cache.load('one', () => {
      throw new Error('uncached');
    })
  ).date,
  100,
);
await cache.load('two', async () => ({ date: 200 }));
await cache.load('three', async () => ({ date: 300 }));
assert.equal(cache.peek('one'), undefined);
await assert.rejects(
  cache.load('failure', async () => {
    throw new Error('offline');
  }),
);
assert.equal(
  (await cache.load('failure', async () => ({ date: 400 }))).date,
  400,
);
assert.notEqual(
  captureMetadataKey(1, -89.7, 21.2, 17),
  captureMetadataKey(1, -89.6, 21.2, 17),
);
assert.notEqual(
  captureMetadataKey(1, -89.7, 21.2, 17),
  captureMetadataKey(1, -89.7, 21.2, 18),
);
await assert.rejects(
  readWithDeadline(() => new Promise(() => {}), 5),
  /timeout/,
);

const erosion = await json('public/data/problems/s34-s2.geojson');
const snapshot = JSON.stringify(erosion);
const grouped = batchTransects(erosion.features);
assert.ok(grouped.features.length <= 5);
assert.equal(
  grouped.features.flatMap((feature) => feature.geometry.coordinates).length,
  erosion.features.length,
);
for (const group of grouped.features) {
  assert.deepEqual(
    group.geometry.coordinates,
    erosion.features
      .filter(
        (feature) => feature.properties.category === group.properties.category,
      )
      .map((feature) => feature.geometry.coordinates),
  );
}
const halo = batchOutlines(erosion.features);
assert.equal(halo.features.length, 1);
assert.deepEqual(
  halo.features[0].geometry.coordinates,
  erosion.features.map((feature) => feature.geometry.coordinates),
);
const a = {
  ...erosion.features[0],
  geometry: {
    type: 'LineString',
    coordinates: [
      [0, 0],
      [100, 0],
    ],
  },
};
const b = {
  ...erosion.features[1],
  geometry: {
    type: 'LineString',
    coordinates: [
      [0, 5],
      [100, 5],
    ],
  },
};
assert.equal(
  nearestTransect([a, b], [40, 1], (point) => point),
  a,
);
assert.equal(
  nearestTransect([a, b], [40, 4], (point) => point),
  b,
);
assert.equal(
  nearestTransect([a, b], [40, 40], (point) => point),
  null,
);
assert.equal(JSON.stringify(erosion), snapshot);

const original = {
  barriers: await json('public/data/problems/structure-outlines.geojson'),
  geotubes: await json('public/data/problems/geotube-historical-axes.geojson'),
  vegetation: null,
};
const registry = await json('public/data/problems/temporal-observations.json');
const resolve = createTemporalEvidenceResolver(original, registry, true);
const frame = (key, date) => ({
  key,
  date,
  source: 'esri',
  center: [-89.55525, 21.30735],
});
const old = resolve(frame('esri:10768', '2015-01-01'));
const recent = resolve(frame('esri:26334', '2025-01-01'));
assert.equal(
  old.layers.barriers,
  recent.layers.barriers,
  'Undated inventory is reused',
);
assert.equal(
  old.layers.geotubes.features.length,
  0,
  'No invention of presence before construction',
);
assert.equal(recent.layers.geotubes.features.length, 6);
assert.equal(
  resolve(frame('esri:26334', '2025-01-01')),
  recent,
  'Repeated captures reuse their resolved state',
);

class FakeLayer {
  constructor(frame) {
    this.options = { ...frame.options };
    this.handlers = {};
    this.container = { dataset: {} };
    this.removed = false;
    this.loading = true;
    this.redraws = 0;
  }
  on(name, callback) {
    this.handlers[name] = callback;
    return this;
  }
  off() {
    assert.equal(this.removed, true, 'Let Leaflet fire its remove cleanup before clearing layer listeners');
    this.handlers = {};
    return this;
  }
  emit(name) {
    this.handlers[name]?.();
  }
  addTo() {
    this.emit('loading');
    return this;
  }
  setOpacity(value) {
    this.opacity = value;
    return this;
  }
  setZIndex(value) {
    this.zIndex = value;
    return this;
  }
  getContainer() {
    return this.container;
  }
  isLoading() {
    return this.loading;
  }
  remove() {
    this.removed = true;
    return this;
  }
  redraw() {
    this.redraws++;
    this.loading = true;
    this.emit('loading');
    return this;
  }
  complete() {
    this.loading = false;
    this.emit('load');
  }
}
const layers = new Map(),
  statuses = [];
const fakeMap=()=>{
  const events=new Map();
  return {getZoom:()=>14,on:(name,fn)=>events.set(name,fn),off:(name,fn)=>{if(events.get(name)===fn)events.delete(name);},emit:name=>events.get(name)?.(),listenerCount:()=>events.size};
};
const frameMap=fakeMap();
const frames = new RasterFrameCache(
  frameMap,
  (frame) => {
    const layer = new FakeLayer(frame);
    layers.set(frame.key, layer);
    return layer;
  },
  (status) => statuses.push(status),
  0,
  0,
);
const raster = (key) => ({
  key,
  url: 'example/' + key,
  options: { maxNativeZoom: 18 },
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
frames.select(raster('A'), [raster('B'), raster('C')]);
await tick();
layers.get('A').complete();
await tick();
layers.get('B').complete();
await tick();
assert.equal(layers.has('C'),false,'Only one neighbour prefetches; the second cannot consume laptop memory or bandwidth');
const count = layers.size;
frames.select(raster('B'), [raster('A'), raster('C')]);
assert.equal(layers.size, count, 'Warm frame reuses decoded layer');
assert.equal(layers.get('B').opacity, 1);
assert.equal(layers.get('A').opacity, 0);
const readyChecks = statuses.length;
frames.select({ ...raster('B'), options: { maxNativeZoom: 20 } }, [
  raster('A'),
  raster('C'),
]);
assert.equal(
  layers.get('B').redraws,
  0,
  'Native-level checks do not reload tiles at an unchanged display level',
);
assert.ok(statuses.slice(readyChecks).every((status) => status === 'ready'));
frames.select(raster('D'));
frames.select(raster('E'));
await tick();
assert.equal(layers.has('D'), false, 'Skipped drag frame is never requested');
assert.equal(
  layers.get('A').removed,
  true,
  'Only the displayed frame and newest request are retained when memory is bounded to two',
);
layers.get('A').complete();
assert.equal(
  statuses.at(-1),
  'loading',
  'Old load cannot settle requested year',
);
layers.get('E').emit('tileerror');
assert.equal(statuses.at(-1), 'error');
assert.equal(
  layers.get('B').opacity,
  0,
  'A failed request never presents old imagery as the new year',
);
frames.select(raster('E'));
await tick();
assert.equal(layers.get('E').redraws, 1);
layers.get('E').complete();
assert.equal(statuses.at(-1), 'ready');
assert.ok([...layers.values()].filter((layer) => !layer.removed).length <= 2);
frames.select(raster('E'),[raster('warm')]);
await tick();
const hidden=layers.get('warm');assert.ok(hidden);
frameMap.emit('movestart');
assert.equal(hidden.removed,true,'Panning detaches hidden captures before they can fetch another viewport');
assert.equal(layers.get('E').removed,false,'The chosen HD image remains on the map during a pan');
frameMap.emit('moveend');await tick();
assert.notEqual(layers.get('warm'),hidden,'One nearby frame can warm again after movement ends');
frames.select(null);
assert.ok([...layers.values()].every(layer=>layer.removed),'Historical local backgrounds release inactive remote tile layers');
const beforeLateLoad=statuses.length;
layers.get('E').complete();
assert.equal(statuses.length,beforeLateLoad,'Released provider cannot overwrite the local background status');
frames.dispose();
assert.equal(frameMap.listenerCount(),0,'Disposing the map releases movement listeners');
assert.ok([...layers.values()].every((layer) => layer.removed));
const stalledLayers = new Map(), stalledStatuses = [];
const bounded = new RasterFrameCache(fakeMap(), frame => {
  const layer = new FakeLayer(frame); stalledLayers.set(frame.key, layer); return layer;
}, status => stalledStatuses.push(status), 0, 0, 15);
bounded.select(raster('old'));
await tick();
const staleLoad = stalledLayers.get('old').handlers.load;
bounded.select(raster('new'));
await tick();
assert.equal(stalledLayers.get('old').removed, true, 'An unfinished obsolete frame releases its requests');
staleLoad();
assert.equal(stalledStatuses.at(-1), 'loading', 'Late callbacks cannot settle another requested frame');
await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(stalledStatuses.at(-1), 'error', 'A stalled provider exits loading with a retry state');
bounded.select(raster('new'));
await tick();
stalledLayers.get('new').complete();
assert.equal(stalledStatuses.at(-1), 'ready', 'Retry after a stalled provider recovers without remounting the map');
bounded.dispose();
console.log(
  'Map performance: exact display batching, nearest-line selection, shared metadata requests, location/zoom isolation, stable inventories, warm raster reuse, coalesced drag, stale-load rejection, retry, hidden-frame pan cleanup and two-frame memory bound passed.',
);
