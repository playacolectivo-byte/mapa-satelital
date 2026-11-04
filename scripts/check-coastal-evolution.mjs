import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { gunzipSync } from 'node:zlib';
import { mergePublishedTransects } from '../lib/problems.ts';
import { batchTransects } from '../lib/map-display.ts';
import { calendarYears } from '../lib/calendar-time.ts';
import { createEvolutionIndex, validateEvolutionCatalogue, evolutionMapData, evolutionComparison, evolutionBarLabels, unavailableLabelPositions } from '../lib/coastal-evolution.ts';

const root = new URL('../', import.meta.url);
const bytes = (path) => readFile(new URL(path, root));
const json = async (path) => JSON.parse(await bytes(path));
const raw = await Promise.all(['l5','l8','s2'].map((mission) => json(`public/data/problems/s34-${mission}.geojson`)));
const inventory = mergePublishedTransects(raw);
assert.equal(inventory.features.length, 9645);
const original = JSON.stringify(inventory);
const catalogue = validateEvolutionCatalogue(await json('public/data/littoral/coastal-evolution.json'));
const catalogueOriginal = JSON.stringify(catalogue);
const index = createEvolutionIndex(catalogue);
for(const cut of catalogue.observations)for(const measurement of cut.measurements)assert.equal(measurement.change_m,null,'The received fixed-2021 delta must not masquerade as the new comparison');
const valuesByCut=new Map(catalogue.observations.map((cut)=>[cut.id,new Map(cut.measurements.map((m)=>[m.transect_id,m]))]));
assert.equal(index.baseline?.datetime.slice(0,4), '1986');
assert.equal(index.baseline.product.id, 'LT05_L2SP_020045_19860414_02_T1');
const gapCatalogue=structuredClone(catalogue);gapCatalogue.observations=gapCatalogue.observations.filter((cut)=>!['1990','1991'].includes(cut.datetime.slice(0,4)));
const gapIndex=createEvolutionIndex(gapCatalogue);
assert.equal(evolutionMapData(inventory,gapIndex,1990),evolutionMapData(inventory,gapIndex,1991),'Calendar gaps reuse invisible geometry without inventing positions');
const years = calendarYears(1986, 2026);
assert.equal(years.length, 41);
const coverage = [];
let compared = 0, geometries = 0, explains = 0, maximumFrameMs = 0;
for (const year of years) {
  const start = performance.now();
  const frame = evolutionMapData(inventory,index,year);
  maximumFrameMs = Math.max(maximumFrameMs,performance.now()-start);
  assert.equal(frame.features.length,9645,'Every received axis uses the same policy, not only the pilot');
  const counts = { available:0, baseline:0, no_reference:0, no_observation:0 };
  for (let i=0;i<frame.features.length;i++) {
    const feature=frame.features[i];
    const comparison=evolutionComparison(index,feature.properties.idPol_Tran,year);
    counts[comparison.status]++;
    if (comparison.status==='available') {
      compared++;
      assert.equal(comparison.beforeCut.datetime.slice(0,4),'1986');
      assert.equal(Number(comparison.afterCut.datetime.slice(0,4)),year,'An older year must never be relabelled as a current observation');
      const actuals = catalogue.observations.filter((cut)=>{const m=valuesByCut.get(cut.id).get(comparison.id);return Number(cut.datetime.slice(0,4))===year && m?.point && m.value!==null && m.quality!=='no_data';}).toSorted((a,b)=>a.datetime.localeCompare(b.datetime));
      assert.equal(comparison.afterCut.id,actuals.at(-1).id,'Last usable record is selected per axis, not one globally incomplete image');
      const expected=Math.round(((comparison.after.raw_interpolated_position_m??comparison.after.value)-(comparison.before.raw_interpolated_position_m??comparison.before.value))/10)*10;
      assert.equal(comparison.changeM,expected);
      assert.deepEqual(feature.geometry.coordinates,[comparison.before.point,comparison.after.point]);
      const labels=evolutionBarLabels(comparison);
      for(const label of labels){
        assert.equal(label.explanation.points.length,1);
        assert.ok(label.explanation.technical.includes('no salud ecológica'));
        explains++;
      }
      geometries++;
    } else if(comparison.status==='baseline') {
      assert.equal(year,1986);
      assert.equal(comparison.changeM,null,'The starting point is not an assertion of zero erosion');
      assert.deepEqual(feature.geometry.coordinates,[comparison.before.point,comparison.before.point]);
    } else if(comparison.status==='no_reference') {
      assert.equal(comparison.changeM,null,'An observed point without 1986 never becomes a loss measurement');
      assert.deepEqual(feature.geometry.coordinates,[comparison.after.point,comparison.after.point]);
      assert.equal(evolutionBarLabels(comparison)[0].explanation.points.length,1);
    } else {
      assert.equal(comparison.changeM,null,'A missing observation is never filled with zero');
      assert.deepEqual(feature.geometry,inventory.features[i].geometry,'Reference axes remain unchanged for hit testing; they are not drawn as fake loss');
    }
  }
  const shown=batchTransects(frame.features).features.flatMap((feature)=>feature.geometry.coordinates);
  assert.equal(shown.length,counts.available+counts.baseline,'No-data axes have no colored erosion stroke');
  const labels=unavailableLabelPositions(frame.features,(p)=>[p[0]*20000,p[1]*20000]);
  assert.ok(labels.length<=10);
  for(let a=0;a<labels.length;a++)for(let b=a+1;b<labels.length;b++)assert.ok(Math.hypot(labels[a].screen[0]-labels[b].screen[0],labels[a].screen[1]-labels[b].screen[1])>=180);
  coverage.push({year,...counts});
}
const no2022=structuredClone(catalogue);no2022.observations=no2022.observations.filter((cut)=>!cut.datetime.startsWith('2022'));
const absentIndex=createEvolutionIndex(no2022);
for(const feature of inventory.features)assert.equal(evolutionComparison(absentIndex,feature.properties.idPol_Tran,2022).changeM,null);
const wrongReference=structuredClone(catalogue);wrongReference.baseline_observation_id=catalogue.observations.find((cut)=>cut.datetime.startsWith('2021')).id;
assert.throws(()=>validateEvolutionCatalogue(wrongReference),/1986/);
const rateInsteadOfPosition=structuredClone(catalogue);rateInsteadOfPosition.observations[0].variable='linear_regression_rate';rateInsteadOfPosition.observations[0].unit='m/year';
assert.throws(()=>validateEvolutionCatalogue(rateInsteadOfPosition),/posiciones/);
const extra=catalogue.observations.find((cut)=>cut.datetime.startsWith('2023-10-21'));
assert.equal(evolutionComparison(index,'P16_T505',2023,extra.id).afterCut.id,extra.id,'An explicitly selected extra capture remains consultable');
assert.notEqual(evolutionComparison(index,'P16_T505',2023).afterCut.id,extra.id,'Annual default is the later actual capture');
assert.equal(JSON.stringify(inventory),original);
assert.equal(JSON.stringify(catalogue),catalogueOriginal);
for(const [path,expected] of Object.entries({
  'public/data/littoral/pilot-series.json':'e1669cd3249797b4f1f4dfada0947b8ab32596043f83e93fff46caa8f7a35a09',
  'public/data/littoral/measurements.csv':'bb0dd9cd67eb0123e9da5206b50075b8d4c097e0a5edecc08d04674ee3ab8d1f',
  'public/data/problems/s34-s2.geojson':'7f3ed501d1e18cef6f5bd6abd20cfe0e3d97356e4ace0b053d54fa7fc819227b',
  'public/data/problems/s34-l5.geojson':'22cf69832b246c523674dfb46df36ca2e19903d09f152d67298648cdf76882df',
  'public/data/problems/s34-l8.geojson':'1589366bfab195196b3e1740a16970cdff7282069b94e4f147c122f0cac20f8a',
}))assert.equal(createHash('sha256').update(await bytes(path)).digest('hex'),expected,'Source unchanged: '+path);
const csv=gunzipSync(await bytes('public/data/littoral/changes-from-1986.csv.gz')).toString('utf8');
const lines=csv.trim().replace(/^\ufeff/,'').split(/\r?\n/);
assert.ok(lines.length>1);
const ids=lines.slice(1).map((line)=>line.split(',').slice(0,2).join(','));
assert.equal(new Set(ids).size,ids.length,'One CSV record per year and received axis');
assert.ok(lines[0].includes('change_from_1986_m'));
const result={checked_at:new Date().toISOString(),status:'passed',all_received_axes:9645,calendar_years:41,baseline_product:index.baseline.product.id,baseline_date:index.baseline.datetime,real_annual_comparisons:compared,exact_endpoint_geometries:geometries,one_point_explanations:explains,csv_rows:lines.length-1,maximum_derivation_ms:Math.round(maximumFrameMs*100)/100,coverage,
checks:['fixed real 1986 baseline','all 9645 source axes','latest usable date per axis/year','no annual interpolation from Alec rates','missing data never become zero or colored loss','stored before/after coordinates','one explanation point','spaced missing-data labels','original five hashes unchanged','CSV row identities unique'],scientific_status:'Exploratory water-edge movement; tide, wave/runup, independent registration, cross-sensor validation and confirmed beach loss remain pending'};
await writeFile(new URL('docs/qa/coastal-evolution-2026-10-27.json',root),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
