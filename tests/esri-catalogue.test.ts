import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchEsriPointMetadata,cachedEsriPointMetadata,fetchRenderedEsriMetadata,cachedRenderedEsriMetadata,loadEsriEditions,parseEsriEditions} from '../lib/esri-catalogue.ts';
import type {WaybackItem} from '@esri/wayback-core';
const item={releaseNum:10,releaseDateLabel:'2014-02-20',itemURL:'https://example.org/tile/10/{z}/{y}/{x}',metadataLayerUrl:'https://example.org/MapServer'} as WaybackItem;
const original=globalThis.fetch;
test('catalogue and point metadata never download images; point query matches SDK and carries abort signal',async()=>{
 const calls:string[]=[];
 globalThis.fetch=async(input,init)=>{calls.push(String(input));assert.ok(init?.signal);const url=new URL(String(input));assert.ok(url.pathname.endsWith('/6/query'));assert.equal(url.searchParams.get('geometryType'),'esriGeometryPoint');assert.equal(url.searchParams.get('outFields'),'SRC_DATE2,NICE_DESC,SRC_DESC,SAMP_RES,SRC_ACC');return new Response(JSON.stringify({features:[{attributes:{SRC_DATE2:Date.UTC(2011,7,1),NICE_DESC:'provider',SRC_DESC:'source',SAMP_RES:.5,SRC_ACC:5}}]}));};
 try {const result=await fetchEsriPointMetadata(item,-89.7,21.2,17);assert.equal(result?.resolution,.5);assert.equal(calls.length,1);assert.deepEqual(cachedEsriPointMetadata(item,-89.7,21.2,17),result);assert.equal(cachedEsriPointMetadata(item,-89.7,21.2,18),undefined);assert.equal(cachedEsriPointMetadata(item,-89.71,21.2,17),undefined);}finally{globalThis.fetch=original;}
});
test('metadata abort cancels underlying fetch and never starts a fallback',async()=>{
 let calls=0;
 globalThis.fetch=async(_input,init)=>{calls++;return new Promise((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));};
 try{const controller=new AbortController();const result=fetchEsriPointMetadata(item,-89.71,21.2,17,controller.signal);controller.abort();await assert.rejects(result,{name:'AbortError'});assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('403 is preserved with no alternate endpoint or image fallback',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status:403});};
 try{await assert.rejects(fetchEsriPointMetadata(item,-89.72,21.2,17),/403/);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('shared catalogue downloads once and ignores future publications',async()=>{
 let calls=0;const raw={'10':{...item,itemTitle:'World Imagery (Wayback 2014-02-20)'},'11':{...item,itemTitle:'World Imagery (Wayback 2099-01-01)'}};
 assert.equal(parseEsriEditions(raw,'2026-10-29').length,1);
 globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify(raw));};
 try{const a=new AbortController(),b=new AbortController();const [one,two]=await Promise.all([loadEsriEditions(a.signal),loadEsriEditions(b.signal)]);assert.deepEqual(one,two);await loadEsriEditions(b.signal);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('each edition resolves its own available tile level without hiding an older photo at a close zoom',async()=>{
 const calls:string[]=[];
 globalThis.fetch=async input=>{
  const url=new URL(String(input));calls.push(url.pathname);
  if(url.pathname.includes('/tilemap/')){
   const [,release,level]=url.pathname.match(/\/tilemap\/(\d+)\/(\d+)\//)!;
   return new Response(JSON.stringify({valid:true,data:[Number(level)<=(release==='10'?17:20)?1:0]}));
  }
  const old=url.pathname.endsWith('/6/query');
  return new Response(JSON.stringify({features:[{attributes:{SRC_DATE2:old?Date.UTC(2011,7,1):Date.UTC(2025,1,13),NICE_DESC:'provider',SRC_DESC:'source',SAMP_RES:old?.5:.6,SRC_ACC:5}}]}));
 };
 try{
  const signal=new AbortController().signal;
  const old=await fetchRenderedEsriMetadata(item,-89.75,21.2,20,signal);
  assert.equal(old?.nativeZoom,17);assert.equal(old?.tileZoom,17);assert.equal(old?.date,Date.UTC(2011,7,1));
  const newer=await fetchRenderedEsriMetadata({...item,releaseNum:11,metadataLayerUrl:'https://example.org/new/MapServer'},-89.75,21.2,20,signal);
  assert.equal(newer?.nativeZoom,20);assert.equal(newer?.tileZoom,20);assert.equal(newer?.date,Date.UTC(2025,1,13));
  assert.deepEqual(cachedRenderedEsriMetadata(item,-89.75,21.2,20),old);
  assert.equal(cachedRenderedEsriMetadata(item,-89.751,21.2,20),undefined);
  const count=calls.length;
  assert.deepEqual(await fetchRenderedEsriMetadata(item,-89.75,21.2,20,signal),old);
  assert.equal(calls.length,count,'reselecting a known photograph needs no further availability or metadata requests');
  assert.ok(calls.every(path=>path.includes('/tilemap/')||path.endsWith('/query')),'no imagery is downloaded by the inventory');
 }finally{globalThis.fetch=original;}
});
test('an availability denial cannot initiate lower-scale or alternate queries',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status:403});};
 try{await assert.rejects(fetchRenderedEsriMetadata(item,-89.76,21.2,20,new AbortController().signal),/403/);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('a wide view does not probe unused higher levels for every catalogue edition',async()=>{
 const paths:string[]=[];
 globalThis.fetch=async input=>{const path=new URL(String(input)).pathname;paths.push(path);return new Response(JSON.stringify(path.includes('/tilemap/')?{valid:true,data:[1]}:{features:[{attributes:{SRC_DATE2:Date.UTC(2015,2,26),NICE_DESC:'provider',SRC_DESC:'source',SAMP_RES:.5,SRC_ACC:5}}]}));};
 try{
  const value=await fetchRenderedEsriMetadata({...item,releaseNum:12,metadataLayerUrl:'https://example.org/wide/MapServer'},-89.77,21.2,13,new AbortController().signal);
  assert.equal(value?.tileZoom,13);assert.equal(value?.nativeZoom,undefined);
  assert.equal(paths.length,2);assert.ok(paths[0].includes('/tilemap/12/13/'));assert.ok(paths[1].endsWith('/10/query'));
 }finally{globalThis.fetch=original;}
});

void test('an overview-level gap cannot permanently cap a later close-up',async()=>{
 const paths:string[]=[];
 const gapItem={...item,releaseNum:99001,metadataLayerUrl:'https://example.org/gap/MapServer'};
 globalThis.fetch=async input=>{
  const path=new URL(input instanceof Request?input.url:input.toString()).pathname;paths.push(path);
  const level=path.match(/\/tilemap\/\d+\/(\d+)\//)?.[1];
  return new Response(JSON.stringify(level?{valid:true,data:[Number(level)===13?0:1]}:{features:[{attributes:{SRC_DATE2:Date.UTC(2011,7,1),NICE_DESC:'provider',SRC_DESC:'source',SAMP_RES:.5,SRC_ACC:5}}]}));
 };
 try{
  const signal=new AbortController().signal;
  const overview=await fetchRenderedEsriMetadata(gapItem,-89.876,21.3,13,signal);
  assert.equal(overview?.tileZoom,12);
  const detail=await fetchRenderedEsriMetadata(gapItem,-89.876,21.3,18,signal);
  assert.equal(detail?.tileZoom,18,'the overview did not inspect level 18 and cannot rule it out');
  assert.ok(paths.some(path=>path.includes('/tilemap/99001/18/')));
 }finally{globalThis.fetch=original;}
});
