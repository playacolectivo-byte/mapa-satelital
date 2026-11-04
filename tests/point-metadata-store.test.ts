import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PointMetadataStore} from '../lib/point-metadata-store.ts';
const value={date:Date.UTC(2025,1,1),provider:'Esri',source:'Source',resolution:0.5,accuracy:5};
test('exact-point metadata survives reload without leaking its date to a different point or zoom',()=>{
 let saved='';const storage={getItem:()=>saved,setItem:(_key:string,v:string)=>{saved=v;}};
 const one=new PointMetadataStore(storage,()=>100);one.write('edition|x|y|17',value);
 const two=new PointMetadataStore(storage,()=>200);
 assert.deepEqual(two.read('edition|x|y|17')?.value,value);
 assert.equal(two.read('edition|x|y|18'),undefined);assert.equal(two.read('edition|other|y|17'),undefined);
});
test('missing dates expire quickly, old captures expire after a day, and storage failures stay harmless',()=>{
 let now=0;const store=new PointMetadataStore({getItem:()=>'{broken',setItem:()=>{throw new Error('quota');}},()=>now);
 store.write('missing',null);store.write('known',value);now=60001;
 assert.equal(store.read('missing'),undefined);assert.deepEqual(store.read('known')?.value,value);
 now=86400001;assert.equal(store.read('known'),undefined);
});
test('the persistent metadata store stays bounded',()=>{
 let saved='';const store=new PointMetadataStore({getItem:()=>null,setItem:(_key,v)=>{saved=v;}},()=>1);
 for(let i=0;i<1000;i++)store.write('point-'+i,value);
 assert.ok(saved.length<=120000);assert.equal(store.read('point-0'),undefined);assert.ok(store.read('point-999'));
});
