import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TileRecovery} from '../lib/tile-recovery.ts';
const tick=()=>new Promise(resolve=>setTimeout(resolve,8));
test('a transient tile retries the same request twice, then reports a final failure',async()=>{
 const recovery=new TileRecovery(1,2),tile={},calls:string[]=[];
 assert.equal(recovery.failed(tile,()=>calls.push('same-url')),true);await tick();
 assert.equal(recovery.failed(tile,()=>calls.push('same-url')),true);await tick();
 assert.equal(recovery.failed(tile,()=>calls.push('unexpected')),false);await tick();
 assert.deepEqual(calls,['same-url','same-url']);recovery.dispose();
});
test('unloaded tiles and disposed years cannot start obsolete retries',async()=>{
 const recovery=new TileRecovery(2),a={},b={};let calls=0;
 recovery.failed(a,()=>calls++);recovery.failed(b,()=>calls++);
 recovery.cancel(a);recovery.dispose();await tick();assert.equal(calls,0);
});
test('successful recovery resets the retry budget for a fresh request',async()=>{
 const recovery=new TileRecovery(1,1),tile={};let calls=0;
 recovery.failed(tile,()=>calls++);await tick();recovery.cancel(tile);
 assert.equal(recovery.failed(tile,()=>calls++),true);await tick();assert.equal(calls,2);recovery.dispose();
});
