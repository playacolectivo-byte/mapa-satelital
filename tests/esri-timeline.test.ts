import { readFileSync } from 'node:fs';
import { ESRI_PROJECT_FIRST_YEAR } from '../lib/calendar-time.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WaybackItem, WaybackMetadata } from '@esri/wayback-core';
import { isVerifiedHdYear, metadataCaptureDate, nearestAvailableCapture, calendarCaptureToLoad, retainDatedEsriDuringProbe, chooseLocalCapture, captureForCalendarYear, captureIndex, publishCaptureList, lockCaptureList, distinctLocalCaptures, editionForCapture, captureOptions, selectedCapture, mergePointMetadata, metadataProbeQueue, PointMetadataProbeQueue, type PointProbeJob, type ScopedPointMetadata } from '../lib/esri-captures.ts';
import { TimelineCache, captureMetadataKey } from '../lib/timeline-cache.ts';

const item = (releaseNum: number, date = '2026-01-01') => ({ releaseNum, releaseDateLabel: date, itemURL: 'https://example.test/' + releaseNum }) as WaybackItem;
const metadata = (date: string, provider = 'DigitalGlobe'): WaybackMetadata => ({ date: Date.parse(date + 'T00:00:00Z'), provider, source: 'WV02', resolution: .5, accuracy: 10.2 });
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

void test('capture identity is its real date, never publication year or provider rename', () => {
  const releases = [item(1, '2014-02-20'), item(2, '2026-09-24'), item(3, '2025-02-01'), item(4, '2027-01-01')];
  const values = { 1: metadata('2011-08-01'), 2: metadata('2011-08-01', 'Vantor'), 3: metadata('2025-02-13'), 4: metadata('2025-02-13') };
  const captures = distinctLocalCaptures(releases, values, '2026-10-29');
  assert.deepEqual(captures.map((capture) => capture.key), ['esri-capture:2011-08-01', 'esri-capture:2025-02-13']);
  assert.equal(captures[0].editions.length, 2);
  assert.equal(editionForCapture(captures[0], 1).releaseNum, 1, 'new metadata must not replay the selected photograph using another edition');
  assert.equal(editionForCapture(captures[0], undefined).releaseNum, 2);
  assert.equal(chooseLocalCapture(captures, '2018-01-01'), null, 'a missing year cannot silently substitute another photo');
});

void test('out-of-order metadata accumulates in one exact view; old zoom replies are ignored', () => {
  let state: ScopedPointMetadata | null = null;
  const oldZoom = 'Chelem:15', newZoom = 'Chelem:17';
  state = mergePointMetadata(state, oldZoom, { viewKey: oldZoom, release: 20, value: metadata('2025-02-13') });
  state = mergePointMetadata(state, oldZoom, { viewKey: oldZoom, release: 10, value: metadata('2011-08-01') });
  assert.deepEqual(Object.keys(state!.values).sort(), ['10', '20']);
  state = mergePointMetadata(state, newZoom, { viewKey: newZoom, release: 20, value: metadata('2023-09-21') });
  const current = state;
  state = mergePointMetadata(state, newZoom, { viewKey: oldZoom, release: 30, value: metadata('2026-03-01') });
  assert.equal(state, current);
  assert.equal(new Date(state!.values[20].date).getUTCFullYear(), 2023, 'show the actual local date at the new zoom');
  assert.deepEqual(Object.keys(state!.values), ['20']);
  const cachedProof = state;
  assert.equal(mergePointMetadata(state, newZoom, { viewKey: newZoom, release: 20, error: true }), cachedProof, 'a late failure does not erase already received evidence');
});

void test('new dates cannot move the stops during a scrub or replace its chosen date', () => {
  const releases = [item(1), item(2), item(3), item(4)];
  const initial = distinctLocalCaptures(releases, { 2: metadata('2011-08-01'), 4: metadata('2025-02-13') });
  const all = distinctLocalCaptures(releases, { 1: metadata('2010-11-14'), 2: metadata('2011-08-01'), 3: metadata('2018-04-01'), 4: metadata('2025-02-13') });
  const gesture = { scope: 'A', captures: [...initial] };
  assert.deepEqual(captureOptions('A', all, gesture).map((capture) => capture.date), ['2011-08-01', '2025-02-13']);
  const selected = selectedCapture('A', all, gesture, 0);
  assert.equal(selected?.date, '2011-08-01');
  assert.equal(captureOptions('A', all, null).length, 4);
  assert.equal(captureOptions('A', all, null).findIndex((capture) => capture.date === selected?.date), 1);
  assert.equal(selectedCapture('B', all, gesture, 0), null, 'a gesture from the former center must not choose a photo in the new view');
});

void test('a genuinely missing date after a metadata correction is not replaced at release', () => {
  const releases = [item(1), item(2)];
  const gesture = { scope: 'A', captures: distinctLocalCaptures(releases, { 1: metadata('2011-08-01'), 2: metadata('2025-02-13') }) };
  const corrected = distinctLocalCaptures(releases, { 1: metadata('2012-09-30'), 2: metadata('2025-02-13') });
  assert.equal(selectedCapture('A', corrected, gesture, 0), null);
});

void test('catalogue updates and repeated offers never restart the 24-query budget', async () => {
  const pool = new PointMetadataProbeQueue<string>({ maximum: 24, concurrency: 2, failureLimit: 3, timeoutMs: 0 });
  const started: string[] = [];
  const jobs = (start: number, count: number): PointProbeJob<string>[] => Array.from({ length: count }, (_, n) => {
    const key = String(start + n);
    return { key, read: async () => { started.push(key); return key; }, onValue: () => {}, onError: () => assert.fail('unexpected failure') };
  });
  pool.activate('A'); pool.offer('A', jobs(0, 100));
  await tick();
  assert.equal(started.length, 24);
  pool.offer('A', jobs(0, 100)); pool.offer('A', jobs(100, 100));
  await tick();
  assert.equal(started.length, 24);
  assert.equal(new Set(started).size, 24);
  assert.equal(metadataProbeQueue(Array.from({ length: 100 }, (_, i) => item(i + 1)), 99).length, 24);
  pool.dispose();
});

void test('only two physical requests run, including requests left from a prior view', async () => {
  const pool = new PointMetadataProbeQueue<string>({ maximum: 24, concurrency: 2, failureLimit: 3, timeoutMs: 0 });
  const gates = new Map<string, ReturnType<typeof deferred<string>>>();
  const delivered: string[] = [], started: string[] = [];
  let physical = 0, maximum = 0;
  const jobs = (prefix: string) => Array.from({ length: 4 }, (_, n): PointProbeJob<string> => {
    const key = prefix + n, gate = deferred<string>(); gates.set(key, gate);
    return { key, read: () => { started.push(key); physical++; maximum = Math.max(maximum, physical); return gate.promise.finally(() => { physical--; }); }, onValue: (value) => { delivered.push(String(value)); }, onError: () => assert.fail('unexpected failure') };
  });
  pool.activate('old'); pool.offer('old', jobs('old')); await tick();
  pool.activate('new'); pool.offer('new', jobs('new')); await tick();
  assert.deepEqual(started, ['old0', 'old1']);
  gates.get('old1')!.resolve('old1'); await tick();
  gates.get('old0')!.resolve('old0'); await tick();
  assert.deepEqual(delivered, []);
  assert.deepEqual(started, ['old0', 'old1', 'new0', 'new1']);
  gates.get('new1')!.resolve('new1'); await tick(); gates.get('new0')!.resolve('new0'); await tick();
  gates.get('new2')!.resolve('new2'); gates.get('new3')!.resolve('new3'); await tick();
  assert.equal(maximum, 2);
  assert.deepEqual(new Set(delivered), new Set(['new0', 'new1', 'new2', 'new3']));
  pool.dispose();
});

void test('three failures stop automatic queries, even with two workers and new catalogues', async () => {
  const pool = new PointMetadataProbeQueue<string>({ maximum: 24, concurrency: 2, failureLimit: 3, timeoutMs: 0 });
  let started = 0, errors = 0;
  const jobs = Array.from({ length: 20 }, (_, i): PointProbeJob<string> => ({ key: 'bad' + i, read: async () => { started++; throw new Error('403'); }, onValue: () => assert.fail('unexpected success'), onError: () => { errors++; } }));
  pool.activate('A'); pool.offer('A', jobs); await tick();
  assert.equal(started, 3); assert.equal(errors, 3);
  pool.activate('B'); pool.offer('B', jobs); await tick();
  assert.equal(started, 3, 'changing the view is not a workaround for a failed service');
  pool.retry(); pool.activate('B'); pool.offer('B', [{ key: 'good', read: async () => { started++; return 'good'; }, onValue: () => {}, onError: () => assert.fail('unexpected failure') }]); await tick();
  assert.equal(started, 4, 'an explicit retry starts a new bounded attempt');
  pool.dispose();
});

void test('a UI deadline does not release an SDK request that is still running', async () => {
  const pool = new PointMetadataProbeQueue<string>({ maximum: 24, concurrency: 2, failureLimit: 3, timeoutMs: 5 });
  const gates = Array.from({ length: 4 }, () => deferred<string>());
  let started = 0;
  let status = '';
  pool.activate('A', (state) => { status = state.status; }); pool.offer('A', gates.map((gate, i) => ({ key: String(i), read: () => { started++; return gate.promise; }, onValue: () => {}, onError: () => {} })));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(started, 2);
  assert.equal(status, 'error', 'stalled physical slots must not leave the visitor in perpetual loading');
  gates[0].resolve('late0'); gates[1].resolve('late1'); await tick();
  assert.equal(started, 3);
  await new Promise((resolve) => setTimeout(resolve, 15));
  gates[2].resolve('late2'); await tick();
  assert.equal(started, 3);
  pool.dispose();
});

void test('isolated transient errors do not truncate the remaining photo catalogue', async () => {
  const pool = new PointMetadataProbeQueue<string>({maximum:24,concurrency:1,failureLimit:3,timeoutMs:0});
  let started=0,delivered=0;
  pool.activate('A');
  pool.offer('A',Array.from({length:12},(_,i)=>({key:String(i),read:async()=>{started++;if(i%2===0)throw new Error('temporary network error');return String(i);},onValue:()=>{delivered++;},onError:()=>{}})));
  await tick();
  assert.equal(started,12);assert.equal(delivered,6);
  pool.dispose();
});

void test('transient failures at an old point do not disable a fresh point', async () => {
  const pool = new PointMetadataProbeQueue<string>({maximum:24,concurrency:2,failureLimit:3,timeoutMs:0});
  let errors=0,received='';
  pool.activate('old');
  pool.offer('old',Array.from({length:8},(_,i)=>({key:'old'+i,read:async()=>{throw new Error('temporary network error');},onValue:()=>{},onError:()=>{errors++;}})));
  await tick();assert.equal(errors,3);
  pool.activate('new');
  pool.offer('new',[{key:'new',read:async()=>'verified',onValue:value=>{received=value!;},onError:()=>assert.fail('unexpected failure')}]);
  await tick();assert.equal(received,'verified');
  pool.dispose();
});

void test('cache shares in-flight metadata but never moves dates between centers or zooms', async () => {
  const cache = new TimelineCache<WaybackMetadata>();
  const key = captureMetadataKey(10, -89.7429508, 21.275, 17), gate = deferred<WaybackMetadata>();
  let reads = 0;
  const first = cache.load(key, () => { reads++; return gate.promise; });
  const duplicate = cache.load(key, () => { reads++; return gate.promise; });
  gate.resolve(metadata('2011-08-01')); await Promise.all([first, duplicate]);
  assert.equal(reads, 1);
  assert.equal(cache.peek(captureMetadataKey(10, -89.7429508, 21.275, 18)), undefined);
  assert.equal(cache.peek(captureMetadataKey(10, -89.73, 21.275, 17)), undefined);
});

void test('an unresolved or absent capture is never represented by the first stop', () => {
  const captures = distinctLocalCaptures([item(1), item(2), item(3)], {1:metadata('2011-08-01'),2:metadata('2022-03-31'),3:metadata('2025-04-14')});
  assert.equal(captureIndex(captures, null), null);
  assert.equal(captureIndex(captures, '2020-01-01'), null);
  assert.equal(captureIndex(captures, '2022-03-31'), 1);
  assert.equal(captureIndex(captures.slice(1), '2022-03-31'), 0, '2022 legitimately starts a different local inventory');
});

void test('published inventory retains dated identities until an explicit update and resets with the view', () => {
  const items = [item(1),item(2),item(3)];
  const recent = distinctLocalCaptures(items, {2:metadata('2022-03-31'),3:metadata('2025-04-14')});
  const full = distinctLocalCaptures(items, {1:metadata('2011-08-01'),2:metadata('2022-03-31'),3:metadata('2025-04-14')});
  const initial = publishCaptureList(null, 'A:19', recent);
  const locked = lockCaptureList(initial,'A:19',recent);
  assert.equal(publishCaptureList(locked,'A:19',full),locked);
  const updated = publishCaptureList(locked,'A:19',full,true);
  assert.equal(captureIndex(updated.captures,'2022-03-31'),1);
  const changedView = publishCaptureList(locked,'B:20',full);
  assert.equal(changedView.scope,'B:20');
  assert.equal(changedView.locked,false);
  assert.equal(captureIndex(changedView.captures,'2022-03-31'),1);
  assert.equal(publishCaptureList(changedView,'B:20',full),changedView, 'unchanged batches do not trigger another render');
});

void test('fixed annual calendar never substitutes a neighbouring photo or changes a valid same-year acquisition', () => {
  const photos=distinctLocalCaptures([item(1),item(2),item(3),item(4)],{1:metadata('2006-01-15'),2:metadata('2022-03-31'),3:metadata('2022-09-25'),4:metadata('2025-04-14')});
  assert.equal(captureForCalendarYear(photos,2016,null),null);
  assert.equal(captureForCalendarYear(photos,2026,'2025-04-14'),null);
  assert.equal(captureForCalendarYear(photos,2022,'2022-03-31')?.date,'2022-03-31');
  assert.equal(captureForCalendarYear(photos,2022,'2025-04-14')?.date,'2022-09-25');
  assert.equal(captureForCalendarYear(photos.slice(1),2006,null),null, 'a pan with no old capture does not borrow 2006 from another location');
});

void test('fixed HD calendar starts at the oldest received submeter capture, not a coarse old overview', () => {
  const received=JSON.parse(readFileSync(new URL('../public/data/history/esri-local-captures.json',import.meta.url),'utf8'));
  const dates=received.sites.flatMap((site:{values:Record<string,{resolution:number;date:number}>})=>Object.values(site.values)).filter((value:{resolution:number;date:number})=>value.resolution>0&&value.resolution<=1).map((value:{date:number})=>new Date(value.date).getUTCFullYear());
  assert.equal(ESRI_PROJECT_FIRST_YEAR,Math.min(...dates));
  assert.equal(ESRI_PROJECT_FIRST_YEAR,2010);
});

void test('same-year pan may retain verified tiles while checking, but a year change or known mismatch cannot', () => {
 const confirmed={year:2023,release:10};
 assert.equal(retainDatedEsriDuringProbe(confirmed,2023,10,true,null),true);
 assert.equal(retainDatedEsriDuringProbe(confirmed,2022,10,true,null),false);
 assert.equal(retainDatedEsriDuringProbe(confirmed,2023,11,true,null),false);
 assert.equal(retainDatedEsriDuringProbe(confirmed,2023,10,true,'2022-03-31'),false);
 assert.equal(retainDatedEsriDuringProbe(confirmed,2023,10,false,null),false);
});

void test('an exact-year photo can load before the remaining inventory and never redirects after verification',()=>{
 const partial=distinctLocalCaptures([item(1),item(2)],{1:metadata('2025-02-13'),2:metadata('2023-09-21')});
 assert.equal(calendarCaptureToLoad(partial,2023,'2025-02-13')?.date,'2023-09-21');
 assert.equal(calendarCaptureToLoad(partial,2023,'2025-02-13',true),null,'Dragging postpones image work until release');
 const later=distinctLocalCaptures([item(1),item(2),item(3)],{1:metadata('2025-02-13'),2:metadata('2023-09-21'),3:metadata('2023-10-26')});
 assert.equal(calendarCaptureToLoad(later,2023,'2023-09-21'),null,'A later exact-year alternative cannot replace the verified current photo');
 assert.equal(calendarCaptureToLoad(later,2021,'2023-09-21'),null,'A missing year never borrows the earlier or later year');
});

void test('the requested-year hint is queried early without dropping selected, oldest or newest editions',()=>{
 const all=[item(1,'2014-01-01'),item(2,'2019-01-01'),item(3,'2023-01-01'),item(4,'2026-01-01')];
 const queue=metadataProbeQueue(all,2,[3,1]);
 assert.deepEqual(queue.map(i=>i.releaseNum),[2,3,4,1]);
 assert.equal(metadataCaptureDate(queue[1] as unknown as WaybackMetadata),null,'Publication and ranking are not capture metadata');
});

void test('missing-year navigation suggests a verified local capture without substituting it', () => {
  const captures = distinctLocalCaptures([item(1), item(2), item(3)], {1:metadata('2023-09-21'),2:metadata('2025-04-14'),3:metadata('2022-03-31')}, '2026-10-29');
  const before = captures.map(capture=>capture.key);
  assert.equal(nearestAvailableCapture(captures,2026)?.year,2025);
  assert.equal(nearestAvailableCapture(captures,2024)?.year,2025);
  assert.equal(calendarCaptureToLoad(captures,2026,null),null);
  assert.deepEqual(captures.map(capture=>capture.key),before);
  assert.equal(nearestAvailableCapture([],2026),null);
});

void test('missing-year suggestions cannot escape the fixed HD calendar into coarse or pre-2010 photographs',()=>{
 const captures=distinctLocalCaptures([item(1),item(2),item(3)],{1:metadata('2006-01-15'),2:{...metadata('2011-01-15'),resolution:15},3:metadata('2025-04-14')},'2026-10-29');
 assert.equal(nearestAvailableCapture(captures,2010)?.year,2025);
 assert.equal(nearestAvailableCapture(captures.slice(0,2),2010),null);
});

void test('obsolete abortable point queries release slots for the latest view without counting as service failures',async()=>{
 const queue=new PointMetadataProbeQueue<number>({maximum:24,concurrency:2,failureLimit:3,timeoutMs:1000});
 const values:number[]=[],started:string[]=[],aborted:string[]=[];let latestState:{status:string;failures:number}|null=null;
 const slow=(key:string):PointProbeJob<number>=>({key,read:signal=>new Promise((_,reject)=>{started.push(key);const cancel=()=>{aborted.push(key);reject(new DOMException('Aborted','AbortError'));};signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();}),onValue:v=>{if(v!==null)values.push(v);},onError:()=>{throw new Error('Cancellation is not a service error');}});
 queue.activate('old');queue.offer('old',[slow('oldA'),slow('oldB')]);await tick();
 queue.activate('latest',state=>{latestState=state;});queue.offer('latest',[{key:'latest',read:async()=>{started.push('latest');return 42;},onValue:v=>{if(v!==null)values.push(v);},onError:()=>{throw new Error('Unexpected');}}]);
 await tick();await tick();assert.deepEqual(aborted.sort(),['oldA','oldB']);assert.deepEqual(values,[42]);assert.equal(latestState!.failures,0);assert.equal(latestState!.status,'ready');queue.dispose();
});

void test('cancelled metadata cache entries cannot block or erase a replacement at the same point',async()=>{
 const cache=new TimelineCache<number>(),controller=new AbortController(),old=deferred<number|null>(),fresh=deferred<number|null>();
 const first=cache.load('point',()=>old.promise,controller.signal);controller.abort();
 const second=cache.load('point',()=>fresh.promise,new AbortController().signal);await tick();
 old.resolve(1);await first;assert.equal(cache.peek('point'),undefined);
 fresh.resolve(2);assert.equal(await second,2);assert.equal(cache.peek('point'),2);
});

void test('HD requires an exact-year capture and a genuine resolution of one metre or better',()=>{
 assert.equal(isVerifiedHdYear(2026,2026,'2026-03-20',.5),true);
 for(const resolution of [null,undefined,0,10,30,NaN])assert.equal(isVerifiedHdYear(2026,2026,'2026-03-20',resolution),false);
 assert.equal(isVerifiedHdYear(2026,2025,'2026-03-20',.5),false);assert.equal(isVerifiedHdYear(2026,2026,'2025-03-20',.5),false);
});
