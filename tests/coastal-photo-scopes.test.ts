import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {municipalPhotoOptions,municipalPhotoYears,municipalPhotoLocation,localMetadataBelongsToLocation,municipalComparisonOptions,municipalComparisonYears,compatibleAnalysisYear,type MunicipalPhotoCatalogue} from '../lib/coastal-photo-scopes.ts';
import type {ReceivedCatalogue} from '../lib/esri-catalogue.ts';
import {distinctLocalCaptures} from '../lib/esri-captures.ts';
const read=(name:string)=>JSON.parse(readFileSync(new URL('../'+name,import.meta.url),'utf8'));
const received=read('public/data/history/esri-local-captures.json') as ReceivedCatalogue;
const catalogue=read('lib/generated/municipal-photo-catalogue.json') as MunicipalPhotoCatalogue&{source_sha256:string};

test('municipal dates come from the dated photo inventory and non-approximate municipal assignments',()=>{
 const model=read('public/data/shorelines/scenario/model.json'),data=read('public/data/shorelines/photo-alignment/data.json');
 assert.equal(catalogue.source_sha256,createHash('sha256').update(readFileSync(new URL('../public/data/shorelines/scenario/model.json',import.meta.url))).digest('hex'));
 const byId=new Map<string,number>(model.targets.map((t:{id:string},i:number)=>[t.id,i]));
 for(const c of catalogue.captures){const i=byId.get(c.profile_id);assert.notEqual(i,undefined);const t=model.targets[i!];assert.equal(t.m,c.municipality);assert.equal(t.municipality_approximate,false);assert.deepEqual(t.p,c.coordinates);assert(data.targets[i!].readings.some((r:{capture:number;releases:number[]})=>data.captures[r.capture].date===c.date&&JSON.stringify(r.releases)===JSON.stringify(c.releases)));}
 for(const view of catalogue.coastal_views){const location=municipalPhotoLocation(catalogue,view.name)!;assert.equal(location.municipality,view.name);assert.deepEqual(location.bounds,view.bounds);assert(model.targets.filter((t:{m:string;municipality_approximate:boolean})=>t.m===view.name&&!t.municipality_approximate).every((t:{p:number[]})=>t.p[0]>=view.bounds[0]&&t.p[0]<=view.bounds[2]&&t.p[1]>=view.bounds[1]&&t.p[1]<=view.bounds[3]));}
});
test('each of thirteen municipalities retains its own complete audited years at every point and zoom',()=>{
 const municipalities=[...new Set(catalogue.captures.map(c=>c.municipality))];assert.equal(municipalities.length,13);
 for(const m of municipalities){const years=municipalPhotoYears(catalogue,m,2010,2026);assert(years.length>0);
  for(const center of [[-90.4,20.86],[-89.66,21.29],[-87.68,21.52]] as [number,number][])for(const zoom of [12,17,20]){
   const options=municipalPhotoOptions(received.items,catalogue,m,center,zoom);
   assert.deepEqual([...new Set(options.map(o=>o.year))],years);assert(options.every(o=>o.reference.name.startsWith(m+' · ')));
  }
 }
 assert(municipalPhotoYears(catalogue,'Progreso',2010,2026).includes(2011));
 assert(!municipalPhotoYears(catalogue,'Progreso',2010,2026).includes(2010));
 assert(!municipalPhotoYears(catalogue,'San Felipe',2010,2026).includes(2011));
});
test('live replies never erase municipal years or insert another municipality capture date',()=>{
 const center:[number,number]=[-89.663,21.282],expected=municipalPhotoYears(catalogue,'Progreso',2010,2026);
 for(const site of received.sites){const local=distinctLocalCaptures(received.items,site.values);const options=municipalPhotoOptions(received.items,catalogue,'Progreso',center,17,local);assert.deepEqual([...new Set(options.map(o=>o.year))],expected);}
});
test('panorama requests a municipality, and panning outside the selected locality cannot import foreign dates',()=>{
 assert.deepEqual(municipalPhotoOptions(received.items,catalogue,null,[-89,21.3],12),[]);
 assert.equal(localMetadataBelongsToLocation([-90.4,20.86],{name:'Progreso',municipality:'Progreso',coordinates:[-89.66,21.28],bounds:[-89.7,21.25,-89.55,21.33]},received.sites),false);
 assert.deepEqual(municipalPhotoYears(catalogue,'Unknown',2010,2026),[]);
 assert(municipalPhotoYears(catalogue,'Progreso',1986,2021).every(y=>y<=2021));
});
test('the date control cannot request camera changes; geographic navigation stays in the place control',()=>{
 const component=readFileSync(new URL('../components/satellite-timeline.tsx',import.meta.url),'utf8');
 assert(!/onRevealCapture|photoReferenceView|setActivePlace|\.coverage\(|\.restore\(|\.setView\(/.test(component));
 assert(component.includes('municipalPhotoOptions'));
});

test('compatible selectors require both a local exact-year release and an accepted photographed reference',()=>{
 const model=read('public/data/shorelines/scenario/model.json'),data=read('public/data/shorelines/photo-alignment/data.json');
 const index=new Map<string,number>(model.targets.map((t:{id:string},i:number)=>[t.id,i]));
 for(const c of catalogue.compatible_captures){
  const row=data.targets[index.get(c.profile_id)!];
  const accepted=row.readings.filter((r:{accepted:boolean})=>r.accepted);
  assert(accepted.some((r:{capture:number})=>/^201[01]-/.test(data.captures[r.capture].date)));
  assert(accepted.some((r:{capture:number;releases:number[]})=>data.captures[r.capture].date===c.date&&c.releases.every(release=>r.releases.includes(release))));
 }
 for(const anchor of catalogue.anchors){
  const options=municipalComparisonOptions(received.items,catalogue,anchor.municipality,anchor.coordinates,17,anchor.coordinates);
  assert.deepEqual([...new Set(options.map(o=>o.year))],municipalComparisonYears(catalogue,anchor.municipality,2010,2026,anchor.coordinates));
  for(const option of options)assert(anchor.captures.some(c=>c.year===option.year&&c.releases.includes(option.item.releaseNum)),anchor.municipality+' '+option.year);
 }
});

test('Ixil Faro cannot offer 2023 over its reviewed 2022 footprint',()=>{
 const coordinates:[number,number]=[-89.4710383,21.3192508];
 const years=municipalComparisonYears(catalogue,'Ixil',2010,2026,coordinates);
 assert(years.includes(2022));assert(!years.includes(2023));
 assert.equal(compatibleAnalysisYear(years,2023),2022);
 const options=municipalComparisonOptions(received.items,catalogue,'Ixil',coordinates,17,coordinates);
 assert(options.every(o=>o.year!==2023));
});

test('municipality changes and rapid year requests always resolve inside the available list',()=>{
 const requests=[2026,2010,2023,2025,2011,2024,NaN,1993,2022,2099];
 for(const view of catalogue.coastal_views){
  const years=municipalComparisonYears(catalogue,view.name,2010,2026);
  assert(years.length>0);
  for(let repeat=0;repeat<20;repeat++)for(const request of requests)assert(years.includes(compatibleAnalysisYear(years,request)!));
 }
 assert.equal(compatibleAnalysisYear([],2023),null);
 assert.deepEqual(municipalComparisonYears(catalogue,null,2010,2026),[]);
});

test('a filtered result layer cannot draw a nominal 100 m pill across a missing kilometre of evidence',async()=>{
 const {coastalSpacingLinks}=await import('../lib/coastal-spacing.ts');
 const positions=[{id:'A',coordinate:[-89.6,21.3] as [number,number]},{id:'B',coordinate:[-89.6+100/(111320*Math.cos(21.3*Math.PI/180)),21.3] as [number,number]},{id:'C',coordinate:[-89.6+1000/(111320*Math.cos(21.3*Math.PI/180)),21.3] as [number,number]}];
 const links=coastalSpacingLinks(positions,150);assert.equal(links.length,1);assert.deepEqual([links[0].from.id,links[0].to.id],['A','B']);
});

test('current municipality editions and acquisition choices never change with pan, zoom or metadata arrival',()=>{
 for(const anchor of catalogue.anchors){
  const expected=municipalComparisonOptions(received.items,catalogue,anchor.municipality,anchor.coordinates,17,anchor.coordinates);
  for(const coordinates of [[-90.4,20.86],[-89.75,21.27],[-89.62,21.30],[-87.68,21.52]] as [number,number][])for(const zoom of [10,12,16,20]){
   assert.deepEqual(municipalComparisonOptions(received.items,catalogue,anchor.municipality,coordinates,zoom,anchor.coordinates),expected);
  }
 }
});

test('Progreso 2019 keeps the higher-coverage reviewed edition across the reported viewport changes',()=>{
 const anchor:[number,number]=[-89.6635773,21.2827334];
 for(const longitude of [-89.75,-89.70,-89.66,-89.62,-89.58,-89.55]){
  const options=municipalComparisonOptions(received.items,catalogue,'Progreso',[longitude,21.30],17,anchor);
  assert.equal(options.find(option=>option.year===2019)?.item.releaseNum,15045);
 }
});
