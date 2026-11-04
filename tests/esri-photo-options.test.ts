import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {WaybackItem,WaybackMetadata} from '@esri/wayback-core';
import {distinctLocalCaptures} from '../lib/esri-captures.ts';
import {analysisPhotoCandidate,esriPhotoMetadataZoom,orderedPhotoHintReleases} from '../lib/esri-photo-options.ts';
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
