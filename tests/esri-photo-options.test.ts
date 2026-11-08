import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {WaybackItem,WaybackMetadata} from '@esri/wayback-core';
import {distinctLocalCaptures} from '../lib/esri-captures.ts';
import {analysisPhotoCandidate,esriPhotoMetadataZoom,orderedPhotoHintReleases,photoReferenceState} from '../lib/esri-photo-options.ts';
import {readFileSync} from 'node:fs';
import {municipalDatedOptions} from '../lib/coastal-photo-scopes.ts';
import {withPhotoPilotCatalogue} from '../lib/photo-pilot-review.ts';
import {esriEditionNativeZoom} from '../lib/satellite-detail.ts';
const item=(releaseNum:number)=>({releaseNum,releaseDateLabel:'2026-01-01'}) as WaybackItem;
const metadata=(date:string)=>({date:Date.parse(date),resolution:.5,provider:'Esri',source:'WV',accuracy:5}) as WaybackMetadata;
const captures=distinctLocalCaptures([item(1),item(2),item(3)],{1:metadata('2011-08-01'),2:metadata('2020-06-07'),3:metadata('2025-02-13')});
test('an old photo remains selected while its metadata is pending and newer dates arrive',()=>{
 const intent={chapter:'current',year:2011,date:'2011-08-01',release:1};
 assert.equal(analysisPhotoCandidate(captures,2011,null,'current',intent),null);
 assert.equal(analysisPhotoCandidate(captures,2011,'2025-02-13','current',intent),null);
 assert.equal(analysisPhotoCandidate(captures,2011,null,'current',null),null);
});
test('changing the analysis can request only an exact matching photo, never the nearest year',()=>{
 const intent={chapter:'current',year:2011,date:'2011-08-01',release:1};
 assert.equal(analysisPhotoCandidate(captures,2020,'2011-08-01','current',intent)?.date,'2020-06-07');
 assert.equal(analysisPhotoCandidate(captures,2024,'2011-08-01','current',intent),null);
 assert.equal(analysisPhotoCandidate(captures,2025,'2025-02-13','current',null),null);
});
test('the inventory scale depends on the real viewport and device ratio, never the selected edition',()=>{
 assert.equal(esriPhotoMetadataZoom(19,2),20);
 assert.equal(esriPhotoMetadataZoom(18,1),18);
 assert.equal(esriPhotoMetadataZoom(12,2),13);
 assert.equal(esriPhotoMetadataZoom(8,1),10);
});
test('a historical chapter cannot retain a photograph newer than its verified date range',()=>{
 const bounds={first:1986,last:2021};
 assert.equal(analysisPhotoCandidate(captures,2021,'2025-02-13','alec',null,bounds)?.date,'2020-06-07');
 assert.equal(analysisPhotoCandidate(captures,2021,null,'alec',null,bounds),null);
 assert.equal(analysisPhotoCandidate(captures,2019,'2011-08-01','alec',null,bounds),null);
});
test('the bounded inventory order is stable for every analysis year',()=>{
 assert.deepEqual(orderedPhotoHintReleases({30:{date:3},10:{date:1},20:{date:2}}),[10,20,30]);
});

test('2015 absence at Chuburná is distinct from partial 2015 coverage in Progreso',()=>{
 const read=(p:string)=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
 const catalogue=withPhotoPilotCatalogue(read('lib/generated/municipal-photo-refined-catalogue.json'),read('lib/generated/progreso-oeste-review-catalogue.json'));
 const items=read('public/data/history/esri-local-captures.json').items;
 const years=(p:[number,number])=>municipalDatedOptions(items,catalogue,'Progreso',p,17,p).map(o=>o.year);
 const chuburna=years([-89.8162133,21.2518533]),progreso=years([-89.6635736,21.2825778]);
 assert.ok(!chuburna.includes(2015));assert.ok(progreso.includes(2015));
 const reference=photoReferenceState({year:2015,years:chuburna,captureDate:'2014-09-18',scopeName:'Chuburná',selectedQueryFailed:false,inventoryFailed:true,catalogueFailed:false});
 assert.equal(reference.queryFailed,false,'a verified 2014 reference is still a successful date lookup');
 assert.match(reference.notice!,/No hay una foto HD de 2015 verificada para Chuburná/);
 const partial=photoReferenceState({year:2015,years:progreso,captureDate:'2014-09-18',scopeName:'Progreso',selectedQueryFailed:false,inventoryFailed:false,catalogueFailed:false});
 assert.match(partial.notice!,/cobertura fotográfica de 2015 en Progreso es parcial/);
 const missingMetadata=photoReferenceState({year:2015,years:progreso,captureDate:null,scopeName:'Progreso',selectedQueryFailed:true,inventoryFailed:false,catalogueFailed:false});
 assert.equal(missingMetadata.queryFailed,true,'actual selected-date failures stay retryable');
 const pannedExact=photoReferenceState({year:2015,years:chuburna,captureDate:'2015-03-26',scopeName:'Chuburná',selectedQueryFailed:false,inventoryFailed:true,catalogueFailed:false});
 assert.equal(pannedExact.notice,null,'an actual dated 2015 capture at the new center takes precedence over the frozen locality calendar');
});

test('an unknown 2015 edition starts conservatively and cannot borrow the newer edition ceiling',()=>{
 assert.equal(esriEditionNativeZoom({release:18820,selectedRelease:18820,selectedNativeZoom:null}),17);
 assert.equal(esriEditionNativeZoom({release:18820,selectedRelease:22252,selectedNativeZoom:20}),17);
 assert.equal(esriEditionNativeZoom({release:18820,selectedRelease:18820,selectedNativeZoom:19}),19);
 assert.equal(esriEditionNativeZoom({release:18820,selectedRelease:22252,selectedNativeZoom:20,cachedNativeZoom:17}),17);
});
