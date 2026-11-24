import assert from 'node:assert/strict';
import { test } from 'node:test';
import type * as Leaflet from 'leaflet';
import { RasterFrameCache,type RasterFrame } from '../lib/raster-frame-cache.ts';
import {displayedPhotoCoastPresentation,type PhotoCoastPresentation} from '../lib/photo-coast.ts';
const tick=()=>new Promise(resolve=>setTimeout(resolve,8));
class FakeMap {
 zoom=15;
 handlers=new Map<string,Set<()=>void>>();
 on(name:string,fn:()=>void){if(!this.handlers.has(name))this.handlers.set(name,new Set());this.handlers.get(name)!.add(fn);}
 off(name:string,fn:()=>void){this.handlers.get(name)?.delete(fn);}
 emit(name:string){for(const fn of this.handlers.get(name)??[])fn();}
 getZoom(){return this.zoom;}
}
class FakeLayer {
 options={maxNativeZoom:18}; opacity=0; removed=false; loading=true; handlers=new Map<string,()=>void>();
 setOpacity(n:number){this.opacity=n;return this;}setZIndex(){return this;}
 on(name:string,fn:()=>void){this.handlers.set(name,fn);return this;}
 addTo(){return this;}remove(){this.removed=true;return this;}off(){this.handlers.clear();return this;}
 getContainer(){return {dataset:{}};}isLoading(){return this.loading;}redraw(){this.loading=true;return this;}
 finish(){this.loading=false;this.handlers.get('load')?.();}
 start(){this.loading=true;this.handlers.get('loading')?.();}
 fail(){this.handlers.get('tileerror')?.();}
}
const frame=(key:string):RasterFrame=>({key,url:'https://example.test/'+key,options:{maxNativeZoom:18}});
void test('transient missing metadata hides, then reuses a fully decoded year without redownloading',async()=>{
 const map=new FakeMap(),layers:FakeLayer[]=[],states:string[]=[];
 const cache=new RasterFrameCache(map as unknown as Leaflet.Map,()=>{const l=new FakeLayer();layers.push(l);return l as unknown as Leaflet.TileLayer;},s=>states.push(s),0,0);
 cache.select(frame('2023'));await tick();layers[0].finish();
 cache.select(null);assert.equal(layers[0].opacity,0);assert.equal(layers[0].removed,false);
 cache.select(frame('2023'));assert.equal(layers.length,1);assert.equal(layers[0].opacity,1);assert.equal(states.at(-1),'ready');cache.dispose();
});
void test('a missing year never displays a cached neighbouring year and hidden frames stop before pan',async()=>{
 const map=new FakeMap(),layers:FakeLayer[]=[];
 const cache=new RasterFrameCache(map as unknown as Leaflet.Map,()=>{const l=new FakeLayer();layers.push(l);return l as unknown as Leaflet.TileLayer;},()=>{},0,0);
 cache.select(frame('2025'));await tick();layers[0].finish();cache.select(null);
 assert.equal(layers[0].opacity,0);map.emit('movestart');assert.equal(layers[0].removed,true);
 cache.select(frame('2025'));await tick();assert.equal(layers.length,2);cache.dispose();
});
void test('obsolete unfinished year is cancelled on absence, and cannot publish a late ready status',async()=>{
 const map=new FakeMap(),layers:FakeLayer[]=[],states:string[]=[];
 const cache=new RasterFrameCache(map as unknown as Leaflet.Map,()=>{const l=new FakeLayer();layers.push(l);return l as unknown as Leaflet.TileLayer;},s=>states.push(s),0,0);
 cache.select(frame('2025'));await tick();cache.select(null);layers[0].finish();
 assert.equal(layers[0].removed,true);assert.equal(states.includes('ready'),false);cache.dispose();
});
void test('a slow successful image recovers after the waiting deadline rather than remaining permanently failed',async()=>{
 const map=new FakeMap(),layers:FakeLayer[]=[],states:string[]=[];
 const cache=new RasterFrameCache(map as unknown as Leaflet.Map,()=>{const l=new FakeLayer();layers.push(l);return l as unknown as Leaflet.TileLayer;},s=>states.push(s),0,0,5);
 cache.select(frame('slow-2011'));await tick();await tick();assert.equal(states.at(-1),'error');
 layers[0].finish();assert.equal(states.at(-1),'ready');assert.equal(layers[0].opacity,1);cache.dispose();
});
void test('a late obsolete image cannot replace the final selected year after a deadline',async()=>{
 const map=new FakeMap(),layers:FakeLayer[]=[],states:string[]=[];
 const cache=new RasterFrameCache(map as unknown as Leaflet.Map,()=>{const l=new FakeLayer();layers.push(l);return l as unknown as Leaflet.TileLayer;},s=>states.push(s),0,0,5);
 cache.select(frame('old'));await tick();await tick();cache.select(null);cache.select(frame('latest'));await tick();layers[1].finish();layers[0].finish();
 assert.equal(states.at(-1),'ready');assert.equal(layers[0].removed,true);assert.equal(layers[1].opacity,1);cache.dispose();
});

void test('reference mode preserves the last ready image while the next one is absent or fails, with honest frame identity',async()=>{
 const map=new FakeMap(),layers:FakeLayer[]=[],displayed:string[]=[];
 const cache=new RasterFrameCache(map as unknown as Leaflet.Map,()=>{const l=new FakeLayer();layers.push(l);return l as unknown as Leaflet.TileLayer;},()=>{},0,0,5,key=>displayed.push(key),()=>true);
 cache.select(frame('reference-2025'));await tick();layers[0].finish();
 cache.select(null);assert.equal(layers[0].opacity,1);assert.equal(displayed.at(-1),'reference-2025');
 cache.select(frame('requested-2023'));await tick();await tick();
 assert.equal(layers[0].opacity,1);assert.equal(layers[1].opacity,0);assert.equal(displayed.at(-1),'reference-2025');
 layers[1].finish();assert.equal(layers[0].opacity,0);assert.equal(layers[1].opacity,1);assert.equal(displayed.at(-1),'requested-2023');cache.dispose();
});
void test('reference mode cannot let an obsolete image overwrite the final photograph or its metadata key',async()=>{
 const map=new FakeMap(),layers:FakeLayer[]=[],displayed:string[]=[];
 const cache=new RasterFrameCache(map as unknown as Leaflet.Map,()=>{const l=new FakeLayer();layers.push(l);return l as unknown as Leaflet.TileLayer;},()=>{},0,0,200,key=>displayed.push(key),()=>true);
 cache.select(frame('base'));await tick();layers[0].finish();cache.select(frame('obsolete'));await tick();cache.select(frame('final'));await tick();layers[2].finish();layers[1].finish();
 assert.equal(displayed.at(-1),'final');assert.equal(layers[1].removed,true);assert.equal(layers[2].opacity,1);cache.dispose();
});

void test('visible raster identity and coastal results remain paired through pans and out-of-order year loads',async()=>{
 const map=new FakeMap(),layers:FakeLayer[]=[];
 const layer={type:'FeatureCollection' as const,features:[]};
 const previous:PhotoCoastPresentation={scope:'Progreso',year:2019,frameKey:'esri:2019',layer};
 const skipped:PhotoCoastPresentation={scope:'Progreso',year:2022,frameKey:'esri:2022',layer};
 const final:PhotoCoastPresentation={scope:'Progreso',year:2025,frameKey:'esri:2025',layer};
 let candidate=previous,committed:PhotoCoastPresentation|null=null,visible:string|null=null;
 const resolve=()=>displayedPhotoCoastPresentation('Progreso',visible,candidate,committed);
 const cache=new RasterFrameCache(map as unknown as Leaflet.Map,()=>{const l=new FakeLayer();layers.push(l);return l as unknown as Leaflet.TileLayer;},()=>{},0,0,200,key=>{visible=key;const next=resolve();if(next===candidate)committed=next;},()=>true);
 cache.select(frame(previous.frameKey));await tick();layers[0].finish();assert.equal(resolve(),previous);
 for(let pan=0;pan<60;pan++){map.emit('movestart');cache.select(frame(previous.frameKey));map.emit('moveend');assert.equal(resolve(),previous);}
 assert.equal(layers.length,1);
 candidate=skipped;cache.select(frame(skipped.frameKey));await tick();assert.equal(resolve(),previous);
 candidate=final;cache.select(frame(final.frameKey));await tick();assert.equal(resolve(),previous);
 layers[2].finish();assert.equal(resolve(),final);layers[1].finish();assert.equal(resolve(),final);
 assert.equal(layers[1].removed,true);assert.equal(layers[2].opacity,1);cache.dispose();
});

void test('a confirmed raster reports the actual Retina source level even when the edition is unchanged', async () => {
 const map = new FakeMap(), layer = new FakeLayer();
 const displayed: [string, number | undefined][] = [];
 const selected = frame('esri:2022');
 selected.options = { maxNativeZoom: 17, zoomOffset: 1, tileSize: 128 };
 Object.assign(layer.options, selected.options);
 const cache = new RasterFrameCache(map as unknown as Leaflet.Map, () => layer as unknown as Leaflet.TileLayer, () => {}, 0, 0, 200, (key, zoom) => displayed.push([key, zoom]));
 map.zoom = 19;
 cache.select(selected);
 await tick();
 layer.start();
 layer.finish();
 assert.deepEqual(displayed.at(-1), ['esri:2022', 18]);
 map.zoom = 16;
 layer.start();
 assert.deepEqual(displayed.at(-1), ['esri:2022', undefined]);
 layer.finish();
 assert.deepEqual(displayed.at(-1), ['esri:2022', 17]);
 map.zoom = 19;
 map.emit('moveend');
 assert.deepEqual(displayed.at(-1), ['esri:2022', 18]);
 cache.dispose();
});

void test('a partial initial image does not confirm a native level for measured overlays', async () => {
 const map = new FakeMap(), layer = new FakeLayer();
 const displayed: [string, number | undefined][] = [];
 const cache = new RasterFrameCache(map as unknown as Leaflet.Map, () => layer as unknown as Leaflet.TileLayer, () => {}, 0, 0, 200, (key, zoom) => displayed.push([key, zoom]));
 cache.select(frame('esri:2025'));
 await tick();
 layer.start();
 layer.fail();
 layer.finish();
 assert.ok(displayed.length > 0);
 assert.ok(displayed.every(([key, zoom]) => key === 'esri:2025' && zoom === undefined));
 cache.dispose();
});

void test('reviewed z17 imagery keeps its edition and confirmed results throughout Retina overzoom',async()=>{
 const map=new FakeMap(),layer=new FakeLayer(),displayed:[string,number|undefined][]=[];
 const selected=frame('esri:reviewed-2022');
 selected.options={maxNativeZoom:16,zoomOffset:1,tileSize:128,maxZoom:20};
 Object.assign(layer.options,selected.options);
 let creations=0;
 const cache=new RasterFrameCache(map as unknown as Leaflet.Map,()=>{creations++;return layer as unknown as Leaflet.TileLayer;},()=>{},0,0,200,(key,zoom)=>displayed.push([key,zoom]));
 map.zoom=16;cache.select(selected);await tick();layer.finish();
 const settled=displayed.length;
 for(const zoom of [17,18,19,20,18,16,20]){
  map.zoom=zoom;layer.start();map.emit('moveend');cache.select(selected);layer.finish();
  assert.deepEqual(displayed.at(-1),[selected.key,17]);
 }
 assert.equal(creations,1);
 assert(displayed.slice(settled).every(([key,zoom])=>key===selected.key&&zoom===17));
 cache.dispose();
});
