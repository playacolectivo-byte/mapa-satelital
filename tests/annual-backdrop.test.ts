import assert from 'node:assert/strict';
import {test} from 'node:test';
import {annualBackdropForYear} from '../lib/annual-backdrop.ts';
import {hasPcAnnualBackdrop,loadPcAnnualBackdrop} from '../lib/pc-annual-backdrop.ts';
import type {HistoricalManifest} from '../lib/history.ts';
const history={attribution:'INEGI',epochs:Array.from({length:16},(_,i)=>({id:'inegi-'+(2010+i),year:2010+i})),frames:Array.from({length:16},(_,i)=>({epoch:'inegi-'+(2010+i),capture_year:2010+i,date_precision:'year',minzoom:8,maxzoom:13,catalogue_url:'https://www.inegi.org.mx/',wms:{url:'https://mapas.inegi.org.mx/geoserver/Sitio_Inegi/wms',layers:'Sitio_Inegi:gm_colornatural_'+(2010+i),version:'1.1.1',format:'image/png'}}))} as unknown as HistoricalManifest;
void test('fallbacks preserve the exact calendar year, and do not turn mixed-year EOX vintages into annual maps',()=>{
 for(let year=2010;year<=2025;year++){
  const fallback=annualBackdropForYear(year,history)!;assert.equal(fallback.year,year);assert.equal(fallback.info.captureDate,null);
  if(year>=2019){assert.equal(fallback.provider,'eox');assert.match(fallback.frame.url,new RegExp('s2cloudless-'+year+'_3857'));assert.match(fallback.info.resolution,/10 m/);}
  else{assert.equal(fallback.provider,'inegi');assert.equal(fallback.frame.wms!.layers,'Sitio_Inegi:gm_colornatural_'+year);assert.match(fallback.info.resolution,/30 m/);}
 }
 assert.equal(annualBackdropForYear(2026,history),null);assert.equal(annualBackdropForYear(2010,null),null);
});
void test('partial early Sentinel mosaics stay excluded; only audited years can register a full-coast fallback',()=>{
 assert.equal(hasPcAnnualBackdrop(2015),false);assert.equal(hasPcAnnualBackdrop(2016),false);
 for(const year of [2017,2018,2026])assert.equal(hasPcAnnualBackdrop(year),true);
});
void test('PC registers the audited annual query, refreshes temporary tile links and shares concurrent requests',async()=>{
 const original=globalThis.fetch,calls:{url:string;body:unknown}[]=[];
 globalThis.fetch=async(input,init)=>{const url=String(input);calls.push({url,body:init?.body?JSON.parse(String(init.body)):null});return Response.json(url.endsWith('/register')?{links:[{rel:'tilejson',href:'https://planetarycomputer.microsoft.com/api/data/v1/mosaic/pc1.test-token/tilejson.json'}]}:{tiles:['https://planetarycomputer.microsoft.com/api/data/v1/mosaic/pc1.test-token/tiles/WebMercatorQuad/{z}/{x}/{y}?assets=visual']});};
 try{
  const [a,b]=await Promise.all([loadPcAnnualBackdrop(2026,101,new AbortController().signal),loadPcAnnualBackdrop(2026,101,new AbortController().signal)]);
  assert.equal(a,b);assert.equal(calls.length,2);assert.match(a.frame.url,/collection=sentinel-2-l2a/);assert.equal((calls[0].body as {datetime:string}).datetime,'2026-01-01T00:00:00Z/2026-10-29T00:00:00Z');assert.equal(a.year,2026);assert.equal(a.info.captureDate,null);
 }finally{globalThis.fetch=original;}
});
void test('an untrusted tile host is rejected rather than fetched or displayed',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({links:[{rel:'tilejson',href:'https://unrelated.test/tilejson.json'}]});};
 try{await assert.rejects(loadPcAnnualBackdrop(2017,102,new AbortController().signal),/Invalid mosaic response/);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
