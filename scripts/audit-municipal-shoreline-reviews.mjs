import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validatePhotoCoast,photoCoastCoordinate,photoCoastComparison} from '../lib/photo-coast.ts';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {projectCoastLabel} from '../lib/project-coast-labels.ts';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const folder='public/data/shorelines/photo-alignment/';
const raw=readFileSync(new URL(folder+'revised-data.json',root));
const sha=createHash('sha256').update(raw).digest('hex');
const sourceReview=read(folder+'revised-source-review.json');
const report={checked_on:'2026-11-06',raw_photo_sha256:sha,field_validated:false,municipalities:[],checks:{fixed_reference:0,missing_reference_without_metres:0,reviewed_endpoint:0,missing_annual_photo:0,strict_unavailable_without_metres:0,strict_metadata_endpoint:0},failures:[]};
const csv=[['source_scope','display_label','profile_id','year','reference_date','reference_state','actual_capture_dates','reviewed_capture_dates','reviewed_editions','state']];
for(const slug of ['progreso','hunucma','dzemul']){
 const base='public/data/municipalities/'+slug+'/';
 const model=read(base+'scenario.json'),photos=validatePhotoCoast(read(base+'photos.json'));
 const index=read(base+'index.json'),bytes=readFileSync(new URL(base+'photos.json',root));assert.equal(createHash('sha256').update(bytes).digest('hex'),index.photos.sha256);
 const cache=createCoastalImageAlignment(model,photos,sourceReview),byId=new Map(photos.targets.map(t=>[t.id,t]));
 const targets=model.targets.filter(t=>t.type.startsWith('Playa')),summary={slug,profiles:targets.length,references:0,reference_gaps:0,reviewed_endpoint_pairs:0,years:[]};
 const groups=new Map();
 for(const t of targets){
  const row=byId.get(t.id);assert.ok(row.review_policy?.reviewed_captures);assert.ok(row.fixed_reference||row.reference_unavailable);
  if(row.fixed_reference)summary.references++;else summary.reference_gaps++;
  for(const r of row.review_policy.reviewed_captures)for(const release of r.releases){const year=Number(photos.captures[r.capture].date.slice(0,4)),key=release+':'+year;const group=groups.get(key)??{release,year,rows:[]};group.rows.push({target:t,capture:r.capture});groups.set(key,group);}
  for(let year=2011;year<=2025;year++){
   const actual=row.readings.filter(r=>photos.captures[r.capture].date.startsWith(year+'-'));
   const approved=row.review_policy.reviewed_captures.filter(r=>photos.captures[r.capture].date.startsWith(year+'-'));
   const date=row.fixed_reference?photos.captures[row.fixed_reference.capture].date:'';
   const state=row.reference_unavailable?'pending_reference':approved.length?'reviewed_photo_available':actual.length?'pending_position_or_source':'no_dated_photo';
   csv.push([t.m,projectCoastLabel(t.m),t.id,year,date,row.fixed_reference?'photograph':'pending',actual.map(r=>photos.captures[r.capture].date).join('|'),approved.map(r=>photos.captures[r.capture].date).join('|'),[...new Set(approved.flatMap(r=>r.releases))].join('|'),state]);
  }
 }
 for(const {release,year,rows} of groups.values()){
  const frame=cache.read(year,release),features=new Map(frame.layer.features.map(f=>[f.id,f]));
  for(const {target,capture} of rows){const row=byId.get(target.id),f=features.get(target.id);if(row.reference_unavailable){assert.equal(f.properties.delta_m,null);continue;}
   const reading=row.readings.find(r=>r.capture===capture),reference=row.readings.find(r=>r.capture===row.fixed_reference.capture);
   assert.equal(f.properties.photo_interpretation,true);assert.equal(f.properties.date_after,photos.captures[capture].date);assert.equal(f.properties.delta_m,reading.offset_m-reference.offset_m);assert.deepEqual(f.geometry.coordinates[1],photoCoastCoordinate(target,reading.offset_m));
   report.checks.reviewed_endpoint++;summary.reviewed_endpoint_pairs++;
  }
 }
 for(let year=2010;year<=2026;year++)for(const release of [11019,22252,26334]){
  for(const f of cache.read(year,release).layer.features){const row=byId.get(f.id),t=model.targets.find(t=>t.id===f.id);
   if(row.fixed_reference){const r=row.readings.find(r=>r.capture===row.fixed_reference.capture);assert.deepEqual(f.properties.baseline_coordinate,photoCoastCoordinate(t,r.offset_m));assert.equal(f.properties.baseline_year,2011);report.checks.fixed_reference++;}
   else{assert.equal(f.properties.delta_m,null);assert.equal(f.properties.scenario_delta_m,null);assert.equal(f.properties.photo_interpretation,false);assert.equal(f.properties.estimated,false);report.checks.missing_reference_without_metres++;}
   if(year>=2011&&year<=2025&&!row.readings.some(r=>photos.captures[r.capture].date.startsWith(year+'-'))){assert.equal(f.properties.delta_m,null);report.checks.missing_annual_photo++;}
  }
 }
 for(let year=2011;year<=2025;year++){const entries=csv.slice(1).filter(r=>r[0]===model.targets[0].m&&r[3]===year);summary.years.push({year,actual_photographs:entries.filter(r=>r[6]).length,reference_and_reviewed_date:entries.filter(r=>r[9]==='reviewed_photo_available').length,pending_reference:entries.filter(r=>r[9]==='pending_reference').length});}
 for(let year=2011;year<=2025;year++)for(const f of photoCoastComparison(model,photos,2011,year,null).features){
  const row=byId.get(f.id);if(!row?.review_policy?.reviewed_captures)continue;
  if(row.reference_unavailable||!row.review_policy.reviewed_captures.some(r=>photos.captures[r.capture].date.startsWith(year+'-'))){assert.equal(f.properties.delta_m,null);assert.equal(f.properties.estimated,false);assert.equal(f.properties.photo_review_pending,true);report.checks.strict_unavailable_without_metres++;}
  if(typeof f.properties.delta_m==='number'){
   const points=f.properties.photo_metadata_points;assert.equal(points.length,2);
   assert.deepEqual(points[0].coordinate,f.geometry.coordinates[0]);assert.deepEqual(points[1].coordinate,f.geometry.coordinates[1]);
   assert.equal(points[0].date,f.properties.date_before);assert.equal(points[1].date,f.properties.date_after);
   const t=model.targets.find(t=>t.id===f.id);
   const match=row.review_policy.reviewed_captures.some(v=>v.releases.includes(points[1].release)&&photos.captures[v.capture].date===points[1].date&&JSON.stringify(photoCoastCoordinate(t,row.readings.find(r=>r.capture===v.capture).offset_m))===JSON.stringify(points[1].coordinate));
   assert.equal(match,true);report.checks.strict_metadata_endpoint++;
  }
 }
 report.municipalities.push(summary);console.log(JSON.stringify(summary));
}
assert.equal(createHash('sha256').update(raw).digest('hex'),sha);
report.matrix_rows=csv.length-1;report.status='pass';
writeFileSync(new URL('docs/qa/municipal-shoreline-complete-audit-20261106.json',root),JSON.stringify(report,null,2)+'\n');
writeFileSync(new URL('docs/qa/municipal-shoreline-year-matrix-20261106.csv',root),csv.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n');
console.log(JSON.stringify(report.checks));
