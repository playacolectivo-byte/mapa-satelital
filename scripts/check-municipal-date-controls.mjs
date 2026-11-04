// Render the actual controls without a browser or external requests. This
// checks initial/reload markup; it does not claim a visual browser walkthrough.
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=fileURLToPath(new URL('../',import.meta.url));
const catalogue=JSON.parse(await readFile(new URL('../lib/generated/municipal-photo-catalogue.json',import.meta.url),'utf8'));
const received=JSON.parse(await readFile(new URL('../public/data/history/esri-local-captures.json',import.meta.url),'utf8'));
const server=await createServer({configFile:root+'vite.public.config.ts',server:{middlewareMode:true},logLevel:'error'});
try{
 const {SatelliteTimeline}=await server.ssrLoadModule(root+'components/satellite-timeline.tsx');
 const {CoastalPlacePicker}=await server.ssrLoadModule(root+'components/coastal-place-picker.tsx');
 const {CoastalAnalysisControls}=await server.ssrLoadModule(root+'components/coastal-analysis-controls.tsx');
 const {municipalComparisonYears,compatibleAnalysisYear}=await server.ssrLoadModule(root+'lib/coastal-photo-scopes.ts');
 const noop=()=>{};const results=[];
 for(const view of catalogue.coastal_views){
  const props={scopeKey:'current:'+view.name,firstYear:2010,lastYear:2026,year:2026,active:true,photoLocation:{name:view.name,municipality:view.name,coordinates:view.coordinates,bounds:view.bounds},center:view.coordinates,viewZoom:13,detail:{nativeZoom:18,status:'ready'},selected:received.items[0],imageStatus:'ready',flightSelected:null,flights:[],localCaptureDates:null,onYearChange:noop,onSource:noop,onChange:noop,onInfo:noop,onMetadata:noop,onFrameChange:noop,onWarmFrames:noop,onFlightChange:noop};
  const html=renderToStaticMarkup(React.createElement(SatelliteTimeline,props));
  const years=[...html.matchAll(/<option[^>]*value="(20\d\d)"/g)].map(m=>Number(m[1]));
  const expected=[...new Set(catalogue.captures.filter(c=>c.municipality===view.name).map(c=>c.year))].sort((a,b)=>a-b);
  assert.deepEqual(years,expected,view.name);assert(html.includes('Años de '+view.name));
  assert.equal(renderToStaticMarkup(React.createElement(SatelliteTimeline,props)),html,'Initial menu must be stable on reload');
  results.push({municipality:view.name,years});
 }
 const groups=results.map(r=>({municipality:r.municipality,years:r.years,places:[]}));
 const nav=renderToStaticMarkup(React.createElement(CoastalPlacePicker,{groups,value:'municipality:Progreso',title:'Costa de Progreso',disabled:false,loading:false,error:false,showYears:true,onSelect:noop,onRetry:noop}));
 for(const r of results){assert(nav.includes('value="municipality:'+r.municipality+'"'));assert(nav.includes('label="'+r.municipality+' · Esri: '+r.years.join(', ')+'"'));}
 const compatibleResults=[];
 for(const anchor of catalogue.anchors){
  const years=municipalComparisonYears(catalogue,anchor.municipality,2010,2026,anchor.coordinates),year=compatibleAnalysisYear(years,2026);
  const props={compatibleComparison:true,scopeKey:'current:'+anchor.municipality,firstYear:2010,lastYear:2026,year,active:true,photoLocation:{name:anchor.municipality,municipality:anchor.municipality,coordinates:anchor.coordinates},center:anchor.coordinates,viewZoom:17,detail:{nativeZoom:18,status:'ready'},selected:received.items[0],imageStatus:'ready',flightSelected:null,flights:[],localCaptureDates:null,onYearChange:noop,onSource:noop,onChange:noop,onInfo:noop,onMetadata:noop,onFrameChange:noop,onWarmFrames:noop,onFlightChange:noop};
  const calls=[];
  const analysisProps={year,years,municipality:anchor.municipality,onYearChange:value=>calls.push(value),comparableCount:10,referenceCount:0,status:'ready',onRetry:noop};
  const photoHtml=renderToStaticMarkup(React.createElement(SatelliteTimeline,props));
  const analysisHtml=renderToStaticMarkup(React.createElement(CoastalAnalysisControls,analysisProps));
  const options=html=>[...html.matchAll(/<option[^>]*value="(20\d\d)"/g)].map(m=>Number(m[1]));
  assert.deepEqual(options(photoHtml),years);assert.deepEqual(options(analysisHtml),years);
  assert(!analysisHtml.includes('checkbox'));assert(!analysisHtml.includes('Fotos · preliminar'));assert(!analysisHtml.includes('optgroup'));
  assert(analysisHtml.includes('Datos y método'));
  // Invoke the actual pure control's event handler: arbitrary/stale values
  // cannot be sent to the parent, even if a menu event is forged or delayed.
  const findSelect=node=>{if(!node||typeof node!=='object')return null;if(node.type==='select')return node;for(const child of React.Children.toArray(node.props?.children)){const found=findSelect(child);if(found)return found;}return null;};
  const select=findSelect(CoastalAnalysisControls(analysisProps));assert(select);
  select.props.onChange({target:{value:'1993'}});assert.deepEqual(calls,[]);
  if(years.length){select.props.onChange({target:{value:String(years[0])}});assert.deepEqual(calls,[years[0]]);}
  compatibleResults.push({municipality:anchor.municipality,coordinates:anchor.coordinates,years,initial_year:year});
 }
 const {default:Explorer}=await server.ssrLoadModule(root+'components/explorer.tsx');
 const explorerHtml=renderToStaticMarkup(React.createElement(Explorer));
 assert(!explorerHtml.includes('Análisis de fotos asistido por ChatGPT'));assert(!explorerHtml.includes('Fotos · preliminar'));
 assert(explorerHtml.includes('Años de Progreso'));
 const pending=renderToStaticMarkup(React.createElement(CoastalAnalysisControls,{year:2025,displayedYear:2019,years:[2019,2025],municipality:'Progreso',onYearChange:noop,comparableCount:122,referenceCount:0,status:'loading',onRetry:noop}));
 assert(pending.includes('Cargando 2025 · visible 2019'));assert(pending.includes('visibles en 2019'));
 console.log(JSON.stringify({status:'passed',type:'actual_component_server_render_and_control_handlers_not_browser',municipalities:results.length,navigation_municipal_choices:13,results,compatible_results:compatibleResults}));
}finally{await server.close();}
