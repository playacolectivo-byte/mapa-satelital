import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {WaybackItem} from '@esri/wayback-core';
import {municipalComparisonOptions,municipalDatedOptions,municipalPhotoLocation,type MunicipalPhotoCatalogue} from '../lib/coastal-photo-scopes.ts';

const read=(p:string)=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const before=read('lib/generated/municipal-photo-refined-catalogue.json') as MunicipalPhotoCatalogue;
const catalogue=read('lib/generated/municipal-photo-reviewed-catalogue.json') as MunicipalPhotoCatalogue;
const items=read('public/data/history/esri-local-captures.json').items as WaybackItem[];
const options=(municipality:string,dated=false)=>{
 const location=municipalPhotoLocation(catalogue,municipality)!;
 return (dated?municipalDatedOptions:municipalComparisonOptions)(items,catalogue,municipality,location.coordinates,17,location.coordinates);
};

void test('all 13 municipal camera scopes and the unreviewed municipal catalogues remain intact',()=>{
 assert.equal(catalogue.coastal_views.length,13);assert.deepEqual(catalogue.coastal_views,before.coastal_views);
 const reviewed=new Set(['Progreso','Hunucmá','Dzemul','Yobaín']);
 for(const key of ['captures','compatible_captures','anchors'] as const){
  assert.deepEqual(catalogue[key].filter(c=>!reviewed.has(c.municipality)),before[key].filter(c=>!reviewed.has(c.municipality)));
 }
});

void test('Hunucmá municipal choices expose its real eastern 2011 references and select the reviewed 2025 edition',()=>{
 const strict=options('Hunucmá'),dated=options('Hunucmá',true);
 for(const choices of [strict,dated]){
  assert.equal(choices.find(o=>o.year===2011)?.item.releaseNum,11019);
  const current=choices.find(o=>o.year===2025)!;assert.equal(current.item.releaseNum,22252);assert.equal(current.date,'2025-03-19');
  assert.ok(!choices.some(o=>o.year===2015));
 }
 const view=catalogue.coastal_views.find(v=>v.name==='Hunucmá')!;
 const whole=catalogue.anchors.find(a=>a.municipality==='Hunucmá'&&a.review_scope==='municipality')!;
 assert.deepEqual(whole.coordinates,view.coordinates);assert.equal(whole.scope_profile_ids?.length,384);
 // The two recovered controls on the sandbar extend this edition's coverage.
 assert.equal(whole.compatible_captures?.filter(c=>c.year===2025&&c.releases.includes(22252)).reduce((n,c)=>n+c.positions,0),154);
});

void test('local Chelem and Chuburná dates do not borrow the 2015 photograph from eastern Progreso',()=>{
 const places=read('public/data/coastal-places.json').places as {name:string;municipality:string;coordinates:[number,number]}[];
 assert.ok(options('Progreso',true).some(o=>o.year===2015));
 for(const name of ['Chelem','Chuburná']){
  const place=places.find(p=>p.name===name)!;
  for(const select of [municipalDatedOptions,municipalComparisonOptions]){
   const local=select(items,catalogue,place.municipality,place.coordinates,17,place.coordinates);
   assert.ok(local.some(o=>o.year===2011),name+' still has its own 2011 photograph');
   assert.equal(local.find(o=>o.year===2011)?.item.releaseNum,11019,name+' opens the fixed August base instead of a later capture of 2011');
   assert.equal(local.find(o=>o.year===2011)?.date,'2011-08-01');
   assert.ok(!local.some(o=>o.year===2015),name+' must not inherit a remote 2015 scene');
  }
 }
});

void test('a dated photograph without a 2011 pair remains browsable without becoming a strict comparison',()=>{
 const view=catalogue.coastal_views.find(v=>v.name==='Hunucmá')!;
 const whole=catalogue.anchors.find(a=>a.municipality==='Hunucmá'&&a.review_scope==='municipality')!;
 const firstDatedOnly=whole.dated_captures!.find(d=>!whole.compatible_captures!.some(c=>c.year===d.year))!;
 assert.ok(firstDatedOnly);
 const strict=municipalComparisonOptions(items,catalogue,'Hunucmá',view.coordinates,17,view.coordinates);
 const dated=municipalDatedOptions(items,catalogue,'Hunucmá',view.coordinates,17,view.coordinates);
 assert.ok(!strict.some(o=>o.year===firstDatedOnly.year));assert.ok(dated.some(o=>o.year===firstDatedOnly.year));
});

void test('Dzemul choices keep real acquisition dates even when the edition was published in 2026',()=>{
 const choices=options('Dzemul');
 assert.equal(choices.find(o=>o.year===2015)?.date,'2015-02-16');
 const current=choices.find(o=>o.year===2025)!;
 assert.equal(current.item.releaseNum,26334);assert.equal(current.date,'2025-12-21');assert.equal(new Date(current.metadata.date).toISOString().slice(0,10),current.date);
 assert.equal(current.year,2025);assert.ok(current.item.releaseDateLabel.startsWith('2026-'));
});

void test('the new reviewed scopes open the fixed August 2011 scene and retain their latest approved dates',()=>{
 for(const [municipality,year,date] of [['Hunucmá',2026,'2026-02-07'],['Yobaín',2025,'2025-09-14']] as const){
  const strict=options(municipality);
  assert.equal(strict.find(o=>o.year===2011)?.date,'2011-08-01');
  assert.equal(strict.find(o=>o.year===2011)?.item.releaseNum,11019);
  assert.equal(strict.find(o=>o.year===year)?.date,date);
 }
});
