import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chapterBounds,initialChapterYears,withChapterYear} from '../lib/coastal-chapters.ts';
import {historicalRates,historicalRetreat} from '../lib/historical-retreat.ts';
test('each pillar retains its year and exact bounds without leaking changes to another pillar',()=>{
 const initial=initialChapterYears(2026);assert.deepEqual(initial,{current:2025,alec:2021,historical:1951});
 const old=withChapterYear(initial,'historical',1910,2026),alec=withChapterYear(old,'alec',1995,2026);
 assert.equal(alec.current,2025);assert.equal(alec.historical,1910);assert.equal(alec.alec,1995);
 assert.equal(withChapterYear(alec,'alec',2026,2026).alec,2021);assert.deepEqual(chapterBounds('historical'),{first:1910,last:1985});
});
test('historical cumulative estimates reproduce published-rate arithmetic and never extrapolate to 1910 or 1985',()=>{
 const [regional,local]=historicalRates;
 assert.deepEqual(historicalRetreat(regional,1978),{years:30,minimum:9,maximum:18});
 assert.deepEqual(historicalRetreat(local,1978),{years:30,minimum:27,maximum:27});
 assert.equal(historicalRetreat(local,1951),null); // No uniform attribution before the 1968 harbour opening.
 for(const year of [1910,1947,1979,1985,2026])assert.equal(historicalRetreat(local,year),null);
 assert.equal(local.geometry,null);assert.equal(local.eligibleAsObservedBar,false);assert.equal(local.statisticalUncertaintyKnown,false);
});
