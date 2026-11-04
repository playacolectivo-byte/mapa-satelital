import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateCoastalScenario,scenarioComparison} from '../lib/coastal-scenario.ts';
const model=validateCoastalScenario(JSON.parse(readFileSync(new URL('../public/data/shorelines/scenario/model.json',import.meta.url),'utf8')));

test('all17 scenario years cover the same13municipalities and retain explicit unvalidated labels',()=>{
 const before=JSON.stringify(model);
 for(const year of model.years){const layer=scenarioComparison(model,year-1,year);assert.equal(layer.features.length,model.targets.length);assert.equal(new Set(layer.features.map(f=>f.properties.municipality)).size,13);for(const f of layer.features){assert.equal(f.properties.scenario_unvalidated,true);assert.equal(f.properties.estimated,true);assert.equal(f.properties.direction_unresolved,true);assert.equal(f.properties.year,year);assert.equal(f.properties.baseline_year,year-1);assert.ok(Number.isFinite(f.properties.delta_m));assert.equal(f.properties.date,undefined);assert.ok(f.geometry.type==='LineString'&&f.geometry.coordinates.every(p=>p.every(Number.isFinite)));}}
 assert.equal(JSON.stringify(model),before,'rendering a comparison cannot modify the scenario inputs');
});
test('reference comparisons add the annual scenario increments without forcing retreat',()=>{
 for(const base of [2010,2015,2020]){const start=scenarioComparison(model,base,base);assert.ok(start.features.every(f=>f.properties.reference_only===true&&f.properties.delta_m===0));const final=scenarioComparison(model,base,2026);final.features.forEach((f,i)=>{assert.equal(f.properties.delta_m,model.targets[i].d.reduce((s,d,j)=>s+(model.years[j]>base?d:0),0));});}
 const recent=scenarioComparison(model,2025,2026);assert.ok(recent.features.some(f=>Number(f.properties.delta_m)<0));assert.ok(recent.features.some(f=>Number(f.properties.delta_m)>0));
 recent.features.forEach((f,i)=>{if(f.geometry.type!=='LineString')assert.fail();assert.deepEqual(f.geometry.coordinates[0],model.targets[i].p,'the nominal2025 endpoint remains on the received cartographic anchor');});
 assert.throws(()=>scenarioComparison(model,2008,2010));assert.throws(()=>scenarioComparison(model,2020,2015));
});
test('scenario inputs and original published studies remain byte-for-byte unchanged',()=>{
 for(const [path,hash]of Object.entries(model.source_hashes))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex'),hash,path);
 const originals={'s34-s2.geojson':'7f3ed501d1e18cef6f5bd6abd20cfe0e3d97356e4ace0b053d54fa7fc819227b','s34-l5.geojson':'22cf69832b246c523674dfb46df36ca2e19903d09f152d67298648cdf76882df','s34-l8.geojson':'1589366bfab195196b3e1740a16970cdff7282069b94e4f147c122f0cac20f8a'};
 for(const [name,hash]of Object.entries(originals))assert.equal(createHash('sha256').update(readFileSync(new URL('../public/data/problems/'+name,import.meta.url))).digest('hex'),hash);
});
test('physical coastline vertices and50m samples stay within101m of a scenario location',()=>{
 const [sx,sy]=model.coordinate_scale,grid=new Map<string,number[][]>();
 const bucket=(p:number[])=>[Math.floor(p[0]*sx/100),Math.floor(p[1]*sy/100)];
 for(const t of model.targets){const [x,y]=bucket(t.p),key=x+','+y;const points=grid.get(key)??[];points.push(t.p);grid.set(key,points);}
 let worst=0,samples=0;
 const check=(p:number[])=>{const [x,y]=bucket(p);let best=Infinity;for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)for(const q of grid.get((x+dx)+','+(y+dy))??[])best=Math.min(best,Math.hypot((p[0]-q[0])*sx,(p[1]-q[1])*sy));worst=Math.max(worst,best);samples++;assert.ok(best<=101,'Uncovered cartographic location: '+p+'; '+best+'m');};
 const coast=JSON.parse(readFileSync(new URL('../public/data/shorelines/series-2015/reference-coast-2025.geojson',import.meta.url),'utf8'));
 for(const f of coast.features){if(f.properties.SUBTIPO==='Línea de cierre')continue;const paths=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates;for(const c of paths){for(let j=1;j<c.length;j++){const a=c[j-1],b=c[j],length=Math.hypot((b[0]-a[0])*sx,(b[1]-a[1])*sy);check(a);for(let d=50;d<length;d+=50)check([a[0]+(b[0]-a[0])*d/length,a[1]+(b[1]-a[1])*d/length]);check(b);}}}
 assert.ok(samples>1000);assert.ok(worst>0);
});
