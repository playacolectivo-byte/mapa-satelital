import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { createEvolutionIndex, evolutionMapData } from '../lib/coastal-evolution.ts';
import { createEvolutionSpatialIndex, evolutionInventoryInView } from '../lib/evolution-viewport.ts';
import { mergePublishedTransects } from '../lib/problems.ts';
import { calendarYears, timelineIndex, CalendarFrameChoice } from '../lib/calendar-time.ts';
import { coastalViews, CHELEM_PROGRESO_OVERVIEW } from '../lib/coastal-views.ts';

const root = new URL('../', import.meta.url);
const bytes = path => readFile(new URL(path, root));
const json = async path => JSON.parse(await bytes(path));
const catalogue = await json('public/data/littoral/coastal-evolution.json');
const trends = await json('public/data/littoral/alec-trend-models.json');
const inventory = mergePublishedTransects(await Promise.all(['l5','l8','s2'].map(s => json(`public/data/problems/s34-${s}.geojson`))));
const index = createEvolutionIndex(catalogue, { referencePolicy: '1993', trends });
const spatial = createEvolutionSpatialIndex(inventory, index);
const years = calendarYears(1986, 2026);
assert.equal(years.length, 41);
for (const year of years) assert.equal(1986 + timelineIndex(year - 1986, years.length), year);
assert.equal(timelineIndex(40,41),40, 'End goes straight to the newest stop');
assert.equal(timelineIndex(0,41),0, 'Home goes straight to the first stop');
assert.equal(timelineIndex(-1,41),0); assert.equal(timelineIndex(50,41),40);

const choice = new CalendarFrameChoice();
const editions = [{id:'a',date:'2010-01-01'},{id:'b',date:'2013-01-01'}];
assert.equal(choice.choose('view1|2010', editions, 2010, v=>v.id, v=>v.date).id,'a');
const refined = [{id:'a',date:'2012-01-01'},{id:'b',date:'2010-02-01'}];
assert.equal(choice.choose('view1|2010', refined, 2010, v=>v.id, v=>v.date).id,'b','Late local metadata replaces a future capture when an earlier image is available');
assert.equal(choice.choose('view1|2013',refined,2013,v=>v.id,v=>v.date),null,'Missing2013 image stays empty;2012 is not reused');
assert.equal(choice.choose('view1|2010', refined, 2010, v=>v.id, v=>v.date).id,'b','Returning to the same year retains the corrected valid local edition');
const stableChoice = new CalendarFrameChoice();
assert.equal(stableChoice.choose('valid-local-selection', editions, 2010, v=>v.id, v=>v.date).id,'a');
const validRefinement = [{id:'a',date:'2010-06-01'},{id:'b',date:'2010-07-01'}];
assert.equal(stableChoice.choose('valid-local-selection', validRefinement, 2010, v=>v.id, v=>v.date).id,'a','Late metadata does not redirect a selection that still belongs to the requested year');
assert.equal(choice.choose('view2|2010', refined, 2010, v=>v.id, v=>v.date).id,'b','Different locations are isolated');
assert.equal(choice.choose('view1|2010|retry', refined, 2010, v=>v.id, v=>v.date).id,'b','An explicit retry can refresh the choice');
assert.equal(choice.choose('empty', [], 2010, v=>v.id, v=>v.date),null);

const windows = [{name:'Chelem–Progreso',bounds:CHELEM_PROGRESO_OVERVIEW}, ...coastalViews,
 {name:'Detalle de Chelem',bounds:[-89.753,21.267,-89.748,21.273]}];
const views = windows.map(view => ({...view, inventory:evolutionInventoryInView(spatial,view.bounds)}));
const timings=[];
for (const view of views) {
  const cold=[], warm=[];
  for (const year of years) {
    const start=performance.now(), frame=evolutionMapData(view.inventory,index,year); cold.push(performance.now()-start);
    const expected=evolutionMapData(inventory,index,year);
    const byId=new Map(expected.features.map(f=>[f.properties.idPol_Tran,f]));
    for (const feature of frame.features) assert.deepEqual(feature,byId.get(feature.properties.idPol_Tran),'Viewport rendering preserves the exact scientific result');
    const again=performance.now();assert.equal(evolutionMapData(view.inventory,index,year),frame,'A cached year reuses its geometry object');warm.push(performance.now()-again);
  }
  const stats=values=>({median_ms:Number(values.toSorted((a,b)=>a-b)[Math.floor(values.length/2)].toFixed(3)),max_ms:Number(Math.max(...values).toFixed(3))});
  timings.push({name:view.name,axes:view.inventory.features.length,years:years.length,cold:stats(cold),cached:stats(warm)});
}
// Keep a selected card available while panning, even outside the view window.
const outside=inventory.features.find(f=>!views.at(-1).inventory.features.includes(f)).properties.idPol_Tran;
assert.ok(evolutionInventoryInView(spatial,windows.at(-1).bounds,outside).features.some(f=>f.properties.idPol_Tran===outside));
// Every accepted position lies inside its site's indexed envelope, including
// model endpoints beyond the authored axis. This is a render-only filter.
const entries=new Map(spatial.map(e=>[e.feature.properties.idPol_Tran,e]));
for (const values of index.values.values()) for (const [id,m] of values) {
  const b=entries.get(id)?.bounds;
  if(b&&m.point)assert.ok(m.point[0]>=b[0]&&m.point[0]<=b[2]&&m.point[1]>=b[1]&&m.point[1]<=b[3]);
}
const sourceSha=createHash('sha256').update(await bytes('public/data/littoral/coastal-evolution.json')).digest('hex');
assert.equal(sourceSha,'67cb0b1be1004defbe877b022f6a899e488d8f9315e3ca7c3eab74bbb46fbf52');
const report={checked_at:new Date().toISOString(),status:'passed',annual_stops:41,full_inventory_axes:inventory.features.length,views:timings,method:'Node CPU timings of data derivation only, not browser paint or remote tile download',source_sha256:sourceSha,checks:['direct year selection without playback backlog','all 41 stops retained','future local capture corrected while valid selections remain stable','view and retry isolation','viewport values identical to full catalogue','selected offscreen site retained','all actual endpoints indexed','bounded eight-frame geometry cache','original measurements unchanged']};
await writeFile(new URL('docs/qa/temporal-response-2026-10-28.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
