import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SettledSelection} from '../lib/settled-selection.ts';
const pause=()=>new Promise(resolve=>setTimeout(resolve,20));
void test('120 rapid releases commit only the final requested year',async()=>{
 const queue=new SettledSelection(5),values:number[]=[];
 for(let n=0;n<120;n++)queue.request(2010+n%17,value=>values.push(value));
 queue.request(2023,value=>values.push(value));await pause();assert.deepEqual(values,[2023]);queue.cancel();
});
void test('new drag, source switch or unmount cancels the pending selection',async()=>{
 const queue=new SettledSelection(5),values:number[]=[];
 queue.request(2026,v=>values.push(v));queue.cancel();await pause();assert.equal(values.length,0);
 queue.request(2010,v=>values.push(v));await pause();assert.deepEqual(values,[2010]);queue.cancel();
});
void test('a settled selection can be followed by a new gesture without replaying intermediate years',async()=>{
 const queue=new SettledSelection(5),values:number[]=[];
 queue.request(2015,v=>values.push(v));await pause();
 queue.request(2026,v=>values.push(v));queue.request(2011,v=>values.push(v));await pause();assert.deepEqual(values,[2015,2011]);queue.cancel();
});
