// Reproducible numerical/source audit; browser screenshots remain separate.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {applyPhotoVisualReview} from '../lib/photo-visual-review.ts';
import {compatibleSourceLayer} from '../lib/photo-source-review.ts';
import {photoCoastComparison,compatiblePhotoCoastLayer} from '../lib/photo-coast.ts';
import {municipalComparisonOptions} from '../lib/coastal-photo-scopes.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.argv[2];if(!output)throw new Error('Provide an audit output directory');
await mkdir(output,{recursive:true});
const read=async path=>JSON.parse(await readFile(root+path,'utf8'));
const revised=process.argv.includes('--revised');
const model=await read('public/data/shorelines/scenario/model.json'),raw=await readFile(root+'public/data/shorelines/photo-alignment/'+(revised?'revised-data':'data')+'.json');
let photos=JSON.parse(raw);const sha=createHash('sha256').update(raw).digest('hex');
for(const name of revised?['revised-visual-review']:['visual-review','position-review'])photos=applyPhotoVisualReview(photos,await read('public/data/shorelines/photo-alignment/'+name+'.json'),sha);
const sourceReview=await read('public/data/shorelines/photo-alignment/'+(revised?'revised-source-review':'source-position-review')+'.json');assert.equal(sourceReview.data_sha256,sha);
const catalogue=await read('public/data/history/esri-local-captures.json'),municipal=await read('lib/generated/'+(revised?'municipal-photo-refined-catalogue':'municipal-photo-catalogue')+'.json');
const cache=createCoastalImageAlignment(model,photos,sourceReview),frames=[],times=[],index=new Map(model.targets.map((t,i)=>[t.id,i]));
for(const item of catalogue.items){
 const begin=performance.now(),frame=cache.read(2025,item.releaseNum);times.push(performance.now()-begin);
 frames.push({release:item.releaseNum,summary:frame.summary,anchors:frame.layer.features.map(f=>({id:f.id,position:f.properties.image_anchor_coordinate,kind:f.properties.image_alignment,date:f.properties.image_alignment_date}))});
}
await writeFile(output+'/derived-anchors.json',JSON.stringify(frames));
const byYear=[];
for(const year of model.years){
 const f=cache.read(year,26334);
 assert.equal(f.layer.features.length,3110);assert.equal(new Set(f.layer.features.map(f=>f.properties.municipality)).size,13);
 let changed=0;for(const row of f.layer.features)if(row.properties.photo_interpretation===true){const t=model.targets[index.get(row.id)],base=row.properties.baseline_year,old=t.d.reduce((sum,d,j)=>sum+(model.years[j]>base&&model.years[j]<=year?d:0),0);if(old!==row.properties.delta_m)changed++;}
 byYear.push({year,release:26334,...f.summary,photographic_differences_changed_from_model_same_period:changed});
}
const base=cache.read(2025,26334),municipalities={};
for(const f of base.layer.features){const k=f.properties.municipality,group=municipalities[k]??={profiles:0,photoPositions:0,spatialPositions:0,pendingPositions:0,photoComparisons:0};group.profiles++;group.photoPositions+=f.properties.image_alignment==='photo';group.spatialPositions+=f.properties.image_alignment==='spatial_estimate';group.pendingPositions+=f.properties.image_alignment==='cartography';group.photoComparisons+=f.properties.photo_interpretation===true;}
const menu=[];
for(const anchor of municipal.anchors){
 const options=municipalComparisonOptions(catalogue.items,municipal,anchor.municipality,anchor.coordinates,17,anchor.coordinates);
 for(const option of options){const layer=compatibleSourceLayer(compatiblePhotoCoastLayer(photoCoastComparison(model,photos,2010,option.year,option.item.releaseNum,anchor.municipality),anchor.municipality),option.item.releaseNum,sourceReview);assert.ok(layer.features.length>0,anchor.municipality+' '+option.year);}
 menu.push({municipality:anchor.municipality,coordinates:anchor.coordinates,years:options.map(o=>o.year)});
}
const result={type:'Numerical and source-identity audit, not visual/field validation of all profiles',source_sha256:sha,profiles_audited:model.targets.length,captures_audited:photos.targets.reduce((n,t)=>n+t.readings.length,0),years:byYear,municipalities,received_editions:frames.map(f=>({release:f.release,...f.summary})),menus:menu,geometry_timing_ms:{min:Math.min(...times),max:Math.max(...times),median:[...times].sort((a,b)=>a-b)[Math.floor(times.length/2)]},original_model_unchanged:true};
await writeFile(output+'/numerical-qa.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:'passed',profiles:result.profiles_audited,captures:result.captures_audited,years:byYear.length,menu_scopes:menu.length,summary_2025:base.summary,timing:result.geometry_timing_ms}));
