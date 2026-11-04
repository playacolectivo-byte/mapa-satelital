import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {ReceivedCatalogue} from '../lib/esri-catalogue.ts';
import {coastalPhotoOptions,coastalPhotoForYear,photoReferenceView} from '../lib/esri-coastal-photos.ts';
import {distinctLocalCaptures} from '../lib/esri-captures.ts';
import {esriPhotoMetadataZoom} from '../lib/esri-photo-options.ts';
const catalogue=JSON.parse(readFileSync(new URL('../public/data/history/esri-local-captures.json',import.meta.url),'utf8')) as ReceivedCatalogue;
test('2011 and the complete audited date set persist at all nineteen viewpoints and overview scales',()=>{
 let expected:string[]|undefined;
 for(const site of catalogue.sites)for(const zoom of [10,13,17,20]){
  const options=coastalPhotoOptions(catalogue.items,catalogue.sites,site.coordinates,zoom),dates=options.map(c=>c.date);
  assert(options.some(c=>c.year===2011));assert.equal(new Set(dates).size,dates.length);
  if(expected)assert.deepEqual(dates,expected);else expected=dates;
 }
 assert(expected!.length>60);
});
test('the 2011 option carries an audited destination instead of claiming an inland centre has that photograph',()=>{
 const center:[number,number]=[-89.67,21.16];
 const capture=coastalPhotoOptions(catalogue.items,catalogue.sites,center,13).find(c=>c.date==='2011-08-01')!;
 assert(capture);assert.equal(capture.local,false);assert.notDeepEqual(capture.reference.coordinates,center);
 const site=catalogue.sites.find(s=>s.name===capture.reference.name)!;
 assert.equal(new Date(site.values[capture.item.releaseNum].date).toISOString().slice(0,10),capture.date);
});
test('current-point verification wins when the date is truly available in the present view',()=>{
 const site=catalogue.sites.find(s=>s.name==='Progreso')!;
 const local=distinctLocalCaptures(catalogue.items,site.values),options=coastalPhotoOptions(catalogue.items,catalogue.sites,site.coordinates,17,local);
 const old=options.find(c=>c.date==='2011-08-01')!;
 assert.equal(old.local,true);assert.deepEqual(old.reference.coordinates,site.coordinates);
});
test('revealing a reference uses its audited tile scale on standard and Retina screens',()=>{
 const reference={name:'Progreso',coordinates:[-89.66,21.28] as [number,number],zoom:17};
 for(const ratio of [1,2]){
  const view=photoReferenceView(reference,ratio);
  assert.equal(esriPhotoMetadataZoom(view.zoom,ratio),17);assert.deepEqual(view.center,reference.coordinates);
 }
});
test('an analysis-year click reveals the nearest audited 2011 capture, not a newer date at a distant town',()=>{
 const site=catalogue.sites.find(s=>s.name==='Progreso')!,options=coastalPhotoOptions(catalogue.items,catalogue.sites,site.coordinates,13);
 const capture=coastalPhotoForYear(options,2011,site.coordinates)!;
 assert.equal(capture.date,'2011-08-01');assert.deepEqual(capture.reference.coordinates,site.coordinates);
 assert.equal(coastalPhotoForYear(options,1900,site.coordinates),null);
});
test('a new publication of the same photo keeps the edition whose pixels were reviewed',()=>{
 const site=catalogue.sites.find(s=>s.name==='Progreso')!;
 const known=distinctLocalCaptures(catalogue.items,site.values).find(c=>c.date==='2011-08-01')!;
 const fresh={...known.item,releaseNum:999999,releaseDateLabel:'2026-10-30'};
 const local={...known,item:fresh,editions:[fresh,...known.editions]};
 const option=coastalPhotoOptions([...catalogue.items,fresh],catalogue.sites,site.coordinates,17,[local]).find(c=>c.date===known.date)!;
 assert.equal(option.local,true);assert.notEqual(option.item.releaseNum,999999);assert(known.editions.some(i=>i.releaseNum===option.item.releaseNum));
});
test('an unreviewed local edition cannot erase the audited regional reference of the same date',()=>{
 const site=catalogue.sites.find(s=>s.name==='Progreso')!;
 const known=distinctLocalCaptures(catalogue.items,site.values).find(c=>c.date==='2011-08-01')!;
 const fresh={...known.item,releaseNum:999999,releaseDateLabel:'2026-10-30'};
 const option=coastalPhotoOptions([...catalogue.items,fresh],catalogue.sites,site.coordinates,17,[{...known,item:fresh,editions:[fresh]}]).find(c=>c.date===known.date)!;
 assert.equal(option.local,false);assert.notEqual(option.item.releaseNum,999999);
});
