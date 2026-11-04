import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createEvolutionIndex, evolutionComparison, validateEvolutionCatalogue } from '../lib/coastal-evolution.ts';

const root = new URL('../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root)));
const before = validateEvolutionCatalogue(JSON.parse(execFileSync('git', ['show', '5624d2fce5c670f73eaca2db3b0d6b5afb9ac50c:public/data/littoral/coastal-evolution.json'], { cwd: root, maxBuffer: 40 * 1024 * 1024 })));
const after = validateEvolutionCatalogue(await json('public/data/littoral/coastal-evolution.json'));
const positions = (catalogue) => new Map(catalogue.observations.flatMap(c => c.measurements.filter(m => m.point).map(m => [c.product.id+'|'+m.transect_id, { point:m.point, value:m.value, raw:m.raw_interpolated_position_m??m.value }])));
const oldPositions = positions(before), newPositions = positions(after);
for (const [key, value] of oldPositions) assert.deepEqual(newPositions.get(key), value, 'A previously delivered position changed: '+key);
const oldIndex = createEvolutionIndex(before), newIndex = createEvolutionIndex(after);
for (const [id, old] of oldIndex.references) {
  const current = newIndex.references.get(id);
  assert.deepEqual(current.measurement, old.measurement);
  assert.equal(current.cut.id, old.cut.id);
}
const review = await json('scientific/coverage-extension/acceptance-review.json');
const scope = await json('scientific/coverage-extension/scope.json');
const verified = await json('scientific/coverage-extension/verification.json');
assert.equal(scope.transects.features.length, 38);
assert.equal(review.mask_and_threshold_changes, false);
for (const entry of review.visual_reviews) {
  const record = await json('scientific/coverage-extension/records/'+entry.id.replace('sentinel-cached-window-','')+'.json');
  const bytes = await readFile(new URL('scientific/coverage-extension/records/'+record.product.id+'.json', root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.record_sha256);
  const qa = await readFile(new URL(entry.qa_image, root));
  assert.equal(createHash('sha256').update(qa).digest('hex'), entry.qa_sha256);
  assert.equal(record.measurements.filter(m=>m.point).length, entry.usable_positions);
}
for (const [path, sha] of Object.entries(verified.source_hashes_unchanged)) {
  assert.equal(createHash('sha256').update(await readFile(new URL(path, root))).digest('hex'), sha);
}
const core = await json('scientific/annual-waterlines/scope.json');
const coverage = [];
for (let year=1986; year<=2026; year++) {
  const row = { year, before:0, after:0 };
  for (const axis of core.transects.features) {
    const id = axis.properties.idPol_Tran;
    if (evolutionComparison(oldIndex,id,year).after?.point) row.before++;
    if (evolutionComparison(newIndex,id,year).after?.point) row.after++;
  }
  assert(row.after>=row.before);
  coverage.push({...row, added_annual_sites:row.after-row.before});
}
const plan = await json('scientific/coverage-extension/incoming/chelem-progreso/plan.json');
assert.equal(plan.mode,'offline_plan');
assert.equal(new Set(plan.products.map(p=>p.product_id)).size, plan.products.length);
assert.deepEqual([...new Set(plan.products.map(p=>p.year))].sort((a,b)=>a-b),Array.from({length:41},(_,i)=>1986+i));
const report = { checked_at:new Date().toISOString(), status:'passed',
  previous_commit:'5624d2fce5c670f73eaca2db3b0d6b5afb9ac50c',
  previous_unique_positions:oldPositions.size, current_unique_positions:newPositions.size,
  new_unique_positions:newPositions.size-oldPositions.size,
  all_previous_positions_unchanged:true, all_1986_references_unchanged:true,
  checked_original_pilot_results:verified.original_pilot_results_reproduced,
  checked_native_crops:verified.native_crops_verified, checked_immutable_source_files:Object.keys(verified.source_hashes_unchanged).length,
  accepted_expanded_records:review.accepted_observation_ids.length,
  previous_observation_records:before.observations.length, current_observation_records:after.observations.length,
  actual_years_with_data:coverage.filter(c=>c.after).map(c=>c.year),
  pending_years:coverage.filter(c=>!c.after).map(c=>c.year),
  annual_site_observations_added:coverage.reduce((n,c)=>n+c.added_annual_sites,0),
  download_candidates:plan.products.length, network_requests:0, coverage,
  limits:'Cached expansion only; no new year filled, no new satellite download, no tide/wave or independent sensor validation.' };
await writeFile(new URL('docs/qa/cached-coverage-2026-10-27.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,coverage:undefined}));
