// Offline replay of the reported viewport/year bug. No browser, new imagery or
// new scientific observations are involved in this check.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {municipalComparisonOptions} from '../lib/coastal-photo-scopes.ts';
import {photoCoastComparison,compatiblePhotoCoastLayer,displayedPhotoCoastPresentation} from '../lib/photo-coast.ts';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const [catalogue,received,model,data]=await Promise.all([read('lib/generated/municipal-photo-catalogue.json'),read('public/data/history/esri-local-captures.json'),read('public/data/shorelines/scenario/model.json'),read('public/data/shorelines/photo-alignment/data.json')]);
const samples=[],resolutions=[];let choices=0,viewports=0;
for(const anchor of catalogue.anchors){
 const start=performance.now();
 const options=municipalComparisonOptions(received.items,catalogue,anchor.municipality,anchor.coordinates,17,anchor.coordinates);
 resolutions.push(performance.now()-start);
 for(const offset of [-.15,-.04,0,.04,.15])for(const zoom of [10,12,16,20]){
  assert.deepEqual(municipalComparisonOptions(received.items,catalogue,anchor.municipality,[anchor.coordinates[0]+offset,anchor.coordinates[1]],zoom,anchor.coordinates),options);viewports++;
 }
 for(const option of options){
  const layer=compatiblePhotoCoastLayer(photoCoastComparison(model,data,2010,option.year,option.item.releaseNum),anchor.municipality);
  assert(layer.features.length>0);assert(layer.features.every(f=>f.properties.year===option.year&&f.properties.photo_mismatch===false));choices++;
 }
}
const anchor=[-89.6635773,21.2827334];let previous=null;
for(const longitude of [-89.75,-89.70,-89.66,-89.62,-89.58,-89.55]){
 const option=municipalComparisonOptions(received.items,catalogue,'Progreso',[longitude,21.3],17,anchor).find(option=>option.year===2019);
 const layer=compatiblePhotoCoastLayer(photoCoastComparison(model,data,2010,2019,option.item.releaseNum),'Progreso');
 const ids=layer.features.map(f=>f.id);const snapshot={scope:'Progreso',year:2019,frameKey:'esri:'+option.item.releaseNum,layer};
 assert.equal(option.item.releaseNum,15045);assert.equal(ids.length,122);
 if(previous)assert.deepEqual(ids,previous);previous=ids;
 assert.equal(displayedPhotoCoastPresentation('Progreso',snapshot.frameKey,snapshot,null),snapshot);
 samples.push({longitude,year:2019,release:option.item.releaseNum,results:ids.length,id_sha256:createHash('sha256').update(ids.join('|')).digest('hex')});
}
resolutions.sort((a,b)=>a-b);
const receipt={status:'passed',type:'offline_selection_and_scientific_layer_replay_not_browser',scopes:catalogue.anchors.length,municipalities:new Set(catalogue.anchors.map(a=>a.municipality)).size,viewport_zoom_cases:viewports,available_year_choices:choices,local_catalogue_resolution_ms:{median:resolutions[Math.floor(resolutions.length/2)],maximum:resolutions.at(-1),note:'Local computation only; not a browser render or remote imagery download benchmark.'},reported_case:samples};
if(process.argv[2]){await mkdir(process.argv[2],{recursive:true});await writeFile(process.argv[2]+'/replay.json',JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify(receipt));
