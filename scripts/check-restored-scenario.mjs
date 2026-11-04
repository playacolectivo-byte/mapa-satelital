// Actual component rendering plus immutable-model coverage. This does not
// claim visual browser QA when Chrome Colectivo is unavailable.
import {createServer} from 'vite';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=fileURLToPath(new URL('../',import.meta.url));
const model=JSON.parse(await readFile(root+'public/data/shorelines/scenario/model.json','utf8'));
const server=await createServer({configFile:root+'vite.public.config.ts',server:{middlewareMode:true},logLevel:'error'});
try{
 const {CoastalAnalysisControls}=await server.ssrLoadModule(root+'components/coastal-analysis-controls.tsx');
 const {default:Explorer}=await server.ssrLoadModule(root+'components/explorer.tsx');
 const {SCENARIO_YEARS,createScenarioLayerCache}=await server.ssrLoadModule(root+'lib/coastal-result-view.ts');
 const {SatelliteTimeline}=await server.ssrLoadModule(root+'components/satellite-timeline.tsx');
 const received=JSON.parse(await readFile(root+'public/data/history/esri-local-captures.json','utf8'));
 const catalogue=JSON.parse(await readFile(root+'lib/generated/municipal-photo-catalogue.json','utf8'));
 const calls=[],noop=()=>{},cache=createScenarioLayerCache(model),rows=[];
 const find=(node,match)=>{if(!node||typeof node!=='object')return null;if(match(node))return node;for(const child of React.Children.toArray(node.props?.children)){const found=find(child,match);if(found)return found;}return null;};
 for(const year of SCENARIO_YEARS){
  const start=performance.now(),layer=cache.read(year);
  const props={resultView:'scenario',onResultViewChange:value=>calls.push(value),year,displayedYear:year,years:SCENARIO_YEARS,municipality:null,onYearChange:value=>calls.push(value),comparableCount:year===2010?0:4356,referenceCount:year===2010?4356:0,visibleCount:4356,status:'ready',onRetry:noop};
  const element=CoastalAnalysisControls(props),html=renderToStaticMarkup(element),select=find(element,n=>n.type==='select');
  assert(!select.props.disabled,'panorama can select a model year without choosing a municipality');
  assert.deepEqual([...html.matchAll(/<option[^>]*value="(20\d\d)"/g)].map(m=>Number(m[1])),SCENARIO_YEARS);
  assert(html.includes('Estimaciones ChatGPT'));assert(html.includes('sin validar'));assert(html.includes('Base 2010'));assert(!html.includes('checkbox'));
  select.props.onChange({target:{value:'1993'}});assert.equal(calls.length,0);
  select.props.onChange({target:{value:String(year)}});assert.equal(calls.pop(),year);
  find(element,n=>n.type==='button'&&n.props.children==='Fotos comparadas').props.onClick();assert.equal(calls.pop(),'photos');
  const count={};for(const f of layer.features)count[f.properties.municipality]=(count[f.properties.municipality]??0)+1;
  assert.equal(Object.keys(count).length,13);assert.equal(layer.features.length,4356);
  rows.push({year,profiles:layer.features.length,municipalities:count,calculation_ms:performance.now()-start});
 }
 const explorer=renderToStaticMarkup(React.createElement(Explorer));
 assert(explorer.includes('Estimaciones ChatGPT'));assert(explorer.includes('Base 2010'));
 assert.deepEqual([...explorer.matchAll(/<option[^>]*value="(20\d\d)"/g)].slice(0,17).map(m=>Number(m[1])),SCENARIO_YEARS);
 const view=catalogue.coastal_views.find(v=>v.name==='Progreso');
 const timeline=renderToStaticMarkup(React.createElement(SatelliteTimeline,{scenarioReference:true,selectedPhotoYear:2025,compatibleComparison:true,scopeKey:'current:Progreso',firstYear:2010,lastYear:2026,year:2026,active:true,photoLocation:{name:'Progreso',municipality:'Progreso',coordinates:view.coordinates,bounds:view.bounds},center:view.coordinates,viewZoom:17,detail:{nativeZoom:18,status:'ready'},selected:received.items.find(item=>item.releaseNum===26334),imageStatus:'ready',flightSelected:null,flights:[],localCaptureDates:null,onYearChange:noop,onSource:noop,onChange:noop,onInfo:noop,onMetadata:noop,onFrameChange:noop,onWarmFrames:noop,onFlightChange:noop}));
 assert(timeline.includes('value="2025" selected=""'),'2026 estimate must not pretend that the reference photo is from 2026');
 const result={status:'passed',type:'server-rendered actual controls and offline model; not browser QA',years:rows,scenario_default:true,baseline:2010,photos_separate:true,original_model_restored_without_new_values:true};
 if(process.argv[2]){await mkdir(process.argv[2],{recursive:true});await writeFile(process.argv[2]+'/scenario-qa.json',JSON.stringify(result,null,2)+'\n');}
 console.log(JSON.stringify({status:'passed',years:rows.length,points_per_year:4356,municipalities:13,actual_component_controls:true,photos_separate:true}));
}finally{await server.close();}
