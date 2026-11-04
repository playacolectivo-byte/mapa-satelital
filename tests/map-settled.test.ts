import test from 'node:test';
import assert from 'node:assert/strict';
import { onMapSettled } from '../lib/map-settled.ts';
const tick=()=>new Promise<void>(resolve=>queueMicrotask(resolve));
function movement(){
  const events=new Map<string,Set<()=>void>>();
  return {
    on(names:string,fn:()=>void){for(const name of names.split(' ')){if(!events.has(name))events.set(name,new Set());events.get(name)!.add(fn);}},
    off(names:string,fn:()=>void){for(const name of names.split(' '))events.get(name)?.delete(fn);},
    fire(name:string){for(const fn of events.get(name)??[])fn();},
    listeners(){return [...events.values()].reduce((n,s)=>n+s.size,0);},
  };
}
test('a combined zoom and move refreshes the view once, including in background tabs',async()=>{
  const map=movement();let calls=0;onMapSettled(map,()=>calls++);
  map.fire('zoomend');map.fire('moveend');map.fire('moveend');
  assert.equal(calls,0);await tick();assert.equal(calls,1);
  map.fire('moveend');await tick();assert.equal(calls,2);
});
test('unmount cancels queued view work and removes both event subscriptions',async()=>{
  const map=movement();let calls=0;const dispose=onMapSettled(map,()=>calls++);
  assert.equal(map.listeners(),2);map.fire('moveend');dispose();await tick();
  assert.equal(calls,0);assert.equal(map.listeners(),0);
  map.fire('zoomend');await tick();assert.equal(calls,0);
});
test('separate visible layers each keep one independent refresh',async()=>{
  const map=movement();let before=0,after=0;
  const a=onMapSettled(map,()=>before++),b=onMapSettled(map,()=>after++);
  map.fire('moveend');map.fire('zoomend');await tick();
  assert.equal(before,1);assert.equal(after,1);a();
  map.fire('moveend');await tick();assert.equal(before,1);assert.equal(after,2);b();
});
