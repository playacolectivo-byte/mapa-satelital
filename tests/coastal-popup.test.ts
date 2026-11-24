import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {coastalDirectionUnresolved,coastalApparentDirection} from '../lib/coastal-direction.ts';

// Exercise the production DOM builder in isolation from its imagery/catalogue
// loaders. These tests inspect visible content and disclosure state, not markup
// strings or implementation-specific class names.
class Element {
  tagName:string;
  children:Element[]=[];
  ownText='';
  attributes:Record<string,string>={};
  constructor(tagName:string){this.tagName=tagName;}
  set textContent(text:string){this.ownText=text;this.children=[];}
  get textContent():string{return this.ownText+this.children.map(c=>c.textContent).join(' ');}
  appendChild(child:Element){this.children.push(child);return child;}
  replaceChildren(...children:Element[]){this.children=children;}
  setAttribute(name:string,value:string){this.attributes[name]=value;}
}
const require=createRequire(resolve(process.cwd(),'package.json'));
const ts=require('typescript');
const source=readFileSync(new URL('../lib/coastal-analysis.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleExports:Record<string,unknown>={};
runInNewContext(compiled,{
  exports:moduleExports,document:{createElement:(tag:string)=>new Element(tag)},
  ResourceCache:class {},coastalDirectionUnresolved,coastalApparentDirection,
  projectCoastLabel:(name:string)=>name,hasProjectCoastLabel:()=>false,
  receivedEsriCatalogue:{items:[]},regionalAlternativeComparisons:()=>[],
  regionalShorelineAlternatives:{pending:[],sources:{}},datedReviewForMethod:()=>null,
});
const popup=moduleExports.coastalPopup as (feature:unknown)=>Element;
const feature=(properties:Record<string,unknown>)=>({type:'Feature',geometry:{type:'Point',coordinates:[-89.8,21.3]},properties});
const visible=(element:Element):string=>element.tagName==='details'?element.children.filter(c=>c.tagName==='summary').map(visible).join(' '):element.ownText+' '+element.children.map(visible).join(' ');
const base={photo_interpretation:true,baseline_year:2011,year:2025,municipality:'Progreso',photo_date:'2025-04-14',profile_id:'test-profile'};

test('photo result is compact, preserves the apparent sign and folds uncertainty and provenance',()=>{
  const properties={...base,delta_m:-11,direction_unresolved:true,registration_proxy_m:15,grid_spacing_m:100,grid_chainage_m:1200,user_reference_method:'photo'};
  const before=structuredClone(properties),element=popup(feature(properties)),summary=visible(element);
  assert.match(summary,/Cambio estimado/);
  assert.match(summary,/2011 → 2025: ≈ 11 m hacia tierra/);
  assert.match(summary,/Progreso · foto 2025-04-14/);
  assert.doesNotMatch(summary,/incertidumbre|Estación|ChatGPT|borde visible|dirección incierta/);
  assert.match(element.textContent,/la dirección física sigue sin resolverse/);
  assert.match(element.textContent,/Estación 1,200 m/);
  assert.match(element.textContent,/marea/);
  assert(element.children.filter(c=>c.tagName==='details').every(c=>!('open' in c.attributes)));
  assert.deepEqual(properties,before);
});

test('positive photo result reports the apparent advance and keeps method collapsed',()=>{
  const element=popup(feature({...base,delta_m:7,estimated:true,direction_unresolved:true}));
  assert.match(visible(element),/≈ 7 m hacia el agua/);
  assert.match(element.textContent,/incertidumbre/);
});

test('pending, null and invalid readings never fabricate zero metres',()=>{
  for(const delta_m of [null,NaN,Infinity]){
    const element=popup(feature({...base,delta_m,photo_location_matched:true}));
    assert.match(visible(element),/Punto en revisión/);
    assert.doesNotMatch(visible(element),/≈ 0|NaN|Infinity/);
  }
  const pending=popup(feature({...base,photo_review_pending:true,baseline_fixed:true,delta_m:null}));
  assert.match(visible(pending),/sin cambio cuantificable/);
  assert.doesNotMatch(visible(pending),/interpolación|modelo|Perfil test/);
  assert.match(pending.textContent,/no se le asignan metros/);
});

test('trajectory and legacy model missing values remain missing with model disclosure available',()=>{
  for(const mode of ['trajectory_estimate','scenario_unvalidated']){
    const element=popup(feature({[mode]:true,baseline_year:2011,year:2025,comparison_end_year:2025,municipality:'Ixil',delta_m:null,scenario_delta_m:null,image_alignment_date:'2025-11-25'}));
    assert.match(visible(element),/No hay una comparación cuantificable/);
    assert.match(visible(element),/Ixil · foto 2025-11-25/);
    assert.doesNotMatch(visible(element),/≈ 0|NaN|validación|modelo/);
    assert.match(element.textContent,/sin validación|No cuenta con validación/);
  }
});

test('zero comparison and reference markers do not gain an erosion direction',()=>{
  const zero=popup(feature({...base,delta_m:0}));
  assert.match(visible(zero),/≈ 0 m de cambio/);
  assert.doesNotMatch(visible(zero),/hacia tierra|hacia el agua/);
  const reference=popup(feature({...base,delta_m:0,reference_only:true,year:2011}));
  assert.match(visible(reference),/Referencia · 2011/);
  assert.doesNotMatch(visible(reference),/≈|hacia tierra|hacia el agua/);
});
