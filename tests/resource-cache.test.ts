import test from 'node:test';
import assert from 'node:assert/strict';
import { ResourceCache } from '../lib/resource-cache.ts';

const tick = () => new Promise<void>(resolve => queueMicrotask(resolve));
function deferred<T>() {
  let resolve!: (value:T)=>void, reject!: (reason:unknown)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}

test('two concurrent readers share one download; cancelling one does not cancel the other',async()=>{
  const cache=new ResourceCache<object>(12,8),result=deferred<object>();
  let calls=0,physical:AbortSignal|undefined;
  const load=(signal:AbortSignal)=>{calls++;physical=signal;return result.promise;};
  const a=new AbortController(),b=new AbortController();
  const first=cache.read('annual/2021',a.signal,load,1);
  const rejection=assert.rejects(first,{name:'AbortError'});
  const second=cache.read('annual/2021',b.signal,load,1);
  await tick();a.abort();await tick();
  assert.equal(calls,1);assert.equal(physical?.aborted,false);
  const original=Object.freeze({year:2021,delta:-3.76});result.resolve(original);
  assert.equal(await second,original);await rejection;
  assert.equal(await cache.read('annual/2021',b.signal,load,1),original);
  assert.equal(calls,1);
});

test('an abandoned year aborts its physical request and cannot overwrite a newer result',async()=>{
  const cache=new ResourceCache<number>(3,3),old=deferred<number>();
  let signal:AbortSignal|undefined;
  const a=new AbortController(),b=new AbortController();
  const abandoned=cache.read('year/2022',a.signal,s=>{signal=s;return old.promise;});
  const rejected=assert.rejects(abandoned,{name:'AbortError'});
  await tick();a.abort();await tick();assert.equal(signal?.aborted,true);
  assert.equal(await cache.read('year/2022',b.signal,async()=>22),22);
  old.resolve(999);await tick();await tick();await rejected;
  assert.equal(await cache.read('year/2022',b.signal,async()=>777),22);
});

test('effect remount in the same turn reuses the in-flight resource',async()=>{
  const cache=new ResourceCache<number>(2,2),result=deferred<number>();
  let calls=0,physical:AbortSignal|undefined;
  const load=(s:AbortSignal)=>{calls++;physical=s;return result.promise;};
  const a=new AbortController();const first=cache.read('manifest',a.signal,load);
  const rejected=assert.rejects(first,{name:'AbortError'});a.abort();
  const b=new AbortController();const second=cache.read('manifest',b.signal,load);
  await tick();assert.equal(calls,1);assert.equal(physical?.aborted,false);
  result.resolve(1);assert.equal(await second,1);await rejected;
});

test('different years remain isolated and a return to recently visited years avoids reparsing',async()=>{
  const cache=new ResourceCache<{key:string}>(12,12),s=new AbortController().signal;
  let calls=0;
  const read=(key:string)=>cache.read(key,s,async()=>{calls++;return Object.freeze({key});});
  const years=[2026,2023,2025];const originals=[];
  for(const year of years) originals.push(await Promise.all(['bars','before','after'].map(kind=>read(kind+'/'+year))));
  const repeated=await Promise.all(['bars','before','after'].map(kind=>read(kind+'/2026')));
  assert.equal(calls,9);assert.deepEqual(repeated,originals[0]);
  assert.notDeepEqual(originals[0],originals[1]);
});

test('byte budget evicts the least recently used resource and does not retain oversized data',async()=>{
  const cache=new ResourceCache<string>(12,5),s=new AbortController().signal;
  const counts=new Map<string,number>();
  const read=(key:string,size=2)=>cache.read(key,s,async()=>{counts.set(key,(counts.get(key)??0)+1);return key;},size);
  await read('a');await read('b');await read('a');await read('c');
  await read('a');assert.equal(counts.get('a'),1);
  await read('b');assert.equal(counts.get('b'),2);
  await read('huge',6);await read('huge',6);assert.equal(counts.get('huge'),2);
});

test('entry budget applies independently of byte budget and failed downloads can be retried',async()=>{
  const cache=new ResourceCache<string>(2,100),s=new AbortController().signal;
  for(const key of ['a','b','c'])await cache.read(key,s,async()=>key);
  let reloaded=0;await cache.read('a',s,async()=>{reloaded++;return 'a';});assert.equal(reloaded,1);
  await assert.rejects(cache.read('failure',s,async()=>{throw new Error('offline');}));
  assert.equal(await cache.read('failure',s,async()=>'recovered'),'recovered');
});

test('already aborted readers never initiate a request',async()=>{
  const cache=new ResourceCache<number>(2,2),c=new AbortController();c.abort();let calls=0;
  await assert.rejects(cache.read('x',c.signal,async()=>++calls),{name:'AbortError'});
  assert.equal(calls,0);
});
