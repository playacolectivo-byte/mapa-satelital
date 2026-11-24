import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCoastalImageAlignment} from '../lib/coastal-image-alignment.ts';
import {applyCoastal100mGrid,coastalLocalDistance,coastalLocalVector} from '../lib/coastal-100m-grid.ts';
import {applyCoastalMunicipalRefinement} from '../lib/coastal-municipal-refinement.ts';
import {coastalGridSpacingLinks} from '../lib/coastal-spacing.ts';
import {regionalShorelineAlternatives as alternatives,regionalAlternativeComparisons} from '../lib/regional-shoreline-alternatives.ts';

const root=new URL('../',import.meta.url);
const work='work/hunucma-yobain/';
const assets='public/data/shorelines/photo-alignment/';
const raw=path=>readFileSync(new URL(path,root));
const read=path=>JSON.parse(raw(path));
const sha=path=>createHash('sha256').update(raw(path)).digest('hex');
const stage=process.argv.includes('--stage');
const gridPath=stage?work+'grid.json':assets+'coastal-100m-hunucma-yobain.json';
const grid=read(gridPath);
const sourceReview=read(assets+'revised-source-review.json');
const csvRow=fields=>fields.map(field=>'"'+String(field??'').replaceAll('"','""')+'"').join(',');
const extraSourceFields=(source,{change=[],referenceOffset=[],origin=[],azimuth=null}={})=>[
 source.label,source.product_id,source.resolution_m,change[0],change[1],
 referenceOffset[0],referenceOffset[1],origin[0],origin[1],azimuth,source.url,
];
const report={grid_sha256:sha(gridPath),scopes:[]};
if(!stage){
 assert.equal(alternatives.grid_sha256,report.grid_sha256,'La evidencia alternativa debe usar esta malla');
 for(const source of Object.values(alternatives.sources)){
  assert.match(source.date,/^20\d{2}-\d{2}-\d{2}$/);
  assert.ok(source.product_id&&source.label&&source.resolution_m>0&&source.url.startsWith('https://'));
 }
 for(const rows of [alternatives.references,alternatives.comparisons]){
  assert.equal(new Set(rows.map(r=>r.id+':'+r.source)).size,rows.length,'Evidencia repetida');
  for(const row of rows){
   assert.ok(alternatives.sources[row.source]);
   const [lo,hi]=row.interval_m;
   assert.ok(Number.isFinite(lo)&&Number.isFinite(hi)&&hi>lo);
   assert.ok(hi-lo>=alternatives.sources[row.source].resolution_m);
  }
 }
}

const slugs=stage?read(work+'plan.json').scopes.map(scope=>scope.slug):['hunucma','yobain'];
for(const slug of slugs){
 const municipal='public/data/municipalities/'+slug+'/';
 const review=read((stage?work:assets)+'refinement-'+slug+'.json');
 const original=read(municipal+'photos.json');
 const photos=applyCoastalMunicipalRefinement(original,review,sha(assets+'revised-data.json'));
 const model=read(municipal+'scenario.json');
 const municipality=model.targets[0].m;
 const segments=grid.segments.filter(segment=>segment.municipality===municipality);
 const stations=segments.flatMap(segment=>segment.stations);
 const ids=new Map(stations.map(station=>[station.id,station]));
 const alternateRefs=stage?[]:alternatives.references.filter(row=>row.municipality===slug);
 const alternateComparisons=stage?[]:alternatives.comparisons.filter(row=>row.municipality===slug);
 const altCatalogue=stage?[]:alternatives.catalogue.filter(row=>row.municipality===slug);
 assert.equal(ids.size,stations.length);
 assert.ok(stations.length);
 const changed=new Set(review.corrections.map(c=>c.profile_id+':'+c.capture));
 const withheld=new Map((review.withheld??[]).map(c=>[c.profile_id+':'+c.capture+':'+c.release,c.reason]));
 const byProfile=new Map(photos.targets.map(row=>[row.id,row]));
 for(let i=0;i<original.targets.length;i++){
  const before=original.targets[i],after=photos.targets[i];
  for(const reading of before.readings){
   if(!changed.has(before.id+':'+reading.capture))assert.deepEqual(after.readings.find(r=>r.capture===reading.capture),reading);
  }
  for(const approval of before.review_policy?.reviewed_captures??[]){
   if(approval.capture===before.fixed_reference?.capture&&!after.fixed_reference)continue;
   for(const release of approval.releases){
    if(!withheld.has(before.id+':'+approval.capture+':'+release)){
     assert.ok(after.review_policy?.reviewed_captures?.some(r=>r.capture===approval.capture&&r.releases.includes(release)));
    }
   }
  }
 }
 const frames=new Map();
 const beachRows=photos.targets.filter((row,i)=>model.targets[i].type.startsWith('Playa')||row.reviewed_beach_control);
 for(const row of beachRows){
  assert.ok(row.fixed_reference||row.reference_unavailable,row.id);
  for(const reading of row.readings){
   const year=Number(photos.captures[reading.capture].date.slice(0,4));
   if(year<2011||year>review.last_year)continue;
   for(const release of reading.releases)frames.set(year+':'+release,{year,release});
  }
 }
 const cache=createCoastalImageAlignment(model,photos,sourceReview);
 const comparisons=new Map();
 const pending=new Map();
 let checked=0;
 for(const {year,release} of frames.values()){
  const frame=applyCoastal100mGrid(cache.read(year,release).layer,grid);
  assert.equal(frame.features.length,stations.length);
  assert.equal(coastalGridSpacingLinks(frame).length,stations.length-segments.length);
  for(const link of coastalGridSpacingLinks(frame))assert.equal(link.chainage_m,100);
  for(const feature of frame.features){
   checked++;
   const p=feature.properties,station=ids.get(feature.id);
   assert.ok(station);
   assert.deepEqual(p.baseline_coordinate,station.coordinate);
   const key=station.id+':'+year;
   if(p.delta_m===null){
    assert.equal(p.photo_review_pending,true);
    const reasons=pending.get(key)??new Set();
    reasons.add(p.photo_review_reason);
    for(const id of new Set([station.left_profile_id,station.right_profile_id])){
     const reading=byProfile.get(id).readings.find(r=>r.releases.includes(release)&&Number(photos.captures[r.capture].date.slice(0,4))===year);
     const reason=reading&&withheld.get(id+':'+reading.capture+':'+release);
     if(reason)reasons.add(reason);
    }
    pending.set(key,reasons);
    continue;
   }
   assert.equal(feature.geometry.type,'LineString');
   assert.deepEqual(feature.geometry.coordinates[0],station.coordinate);
   const end=feature.geometry.coordinates[1];
   const vector=coastalLocalVector(station.coordinate,end);
   assert.ok(Math.abs(Math.abs(p.delta_m)-coastalLocalDistance(station.coordinate,end))<1e-7);
   assert.ok(Math.abs(vector[0]*station.axis[1]-vector[1]*station.axis[0])<.01);
   assert.equal(Number(p.date_after.slice(0,4)),year);
   assert.ok(p.date_before.startsWith('2011-'));
   if(year===2011)assert.equal(p.delta_m,0);
   const items=comparisons.get(key)??[];
   items.push({date:p.date_after,reference:p.date_before,release,delta:p.delta_m,estimated:p.estimated,direction:p.direction_unresolved?'incierta':p.delta_m>0?'hacia el mar':p.delta_m<0?'hacia tierra':'sin cambio'});
   comparisons.set(key,items);
  }
 }
 const originalFields=['id','tramo','distancia_por_tramo_m','lon_2011','lat_2011','anio','fecha_referencia','fecha_captura','edicion','cambio_m','estimacion_espacial','direccion','estado'];
 const extraFields=['fuente_alternativa','producto_alternativo','resolucion_alternativa_m','cambio_aproximado_min_m','cambio_aproximado_max_m','orilla_desde_localizador_min_m','orilla_desde_localizador_max_m','lon_localizador','lat_localizador','azimut_hacia_mar_grados','url_alternativa'];
 const csv=[stage?originalFields:[...originalFields,...extraFields]];
 const alternativeFrames=new Map();
 for(const row of alternateComparisons){
  const station=ids.get(row.id),source=alternatives.sources[row.source],year=Number(source.date.slice(0,4));
  assert.ok(station&&year>2011&&year<=review.last_year);
  assert.equal(row.reference_date,photos.captures[byProfile.get(station.left_profile_id).fixed_reference.capture].date);
  assert.ok(!comparisons.has(row.id+':'+year),'La alternativa no sustituye mediciones aprobadas');
  if(!alternativeFrames.has(year)){
   const frame=applyCoastal100mGrid(cache.read(year,null).layer,grid);
   alternativeFrames.set(year,new Map(frame.features.map(feature=>[feature.id,feature])));
  }
  const locator=alternativeFrames.get(year).get(row.id);
  assert.equal(locator.properties.photo_review_pending,true);
  assert.equal(locator.properties.delta_m,null);
  assert.deepEqual(locator.geometry,{type:'Point',coordinates:station.coordinate});
 }
 const years=[];
 for(let year=2011;year<=review.last_year;year++){
  let available=0;
  const dates=new Set();
  const alternativeStations=new Set();
  const alternativeDates=new Set();
  for(const segment of segments)for(const station of segment.stations){
   const key=station.id+':'+year;
   const rows=comparisons.get(key);
   const common=[station.id,segment.id,station.chainage_m,...station.coordinate,year];
   if(rows){
    available++;
    for(const item of rows.sort((a,b)=>a.date.localeCompare(b.date)||a.release-b.release)){
     dates.add(item.date);
     csv.push([...common,item.reference,item.date,item.release,item.delta.toFixed(2),item.estimated,item.direction,'medicion_disponible']);
    }
   }else{
    const reference=byProfile.get(station.left_profile_id).fixed_reference;
    const referenceDate=photos.captures[reference.capture].date;
    csv.push([...common,referenceDate,'','','','','',pending.has(key)?[...pending.get(key)].join('|'):'sin_fotografia_para_el_anio']);
    if(!stage)for(const range of regionalAlternativeComparisons(station.id,year)){
     const [lo,hi]=range.interval_m,source=range.capture;
     alternativeStations.add(station.id);
     alternativeDates.add(source.date);
     csv.push([...common,referenceDate,source.date,'','','',lo>0?'hacia el mar':hi<0?'hacia tierra':'incierta','rango_alternativo_aproximado',
      ...extraSourceFields(source,{change:[lo,hi]})]);
    }
    if(!stage)for(const row of alternatives.pending.filter(r=>r.id===station.id&&alternatives.sources[r.source].date.startsWith(year+'-'))){
     const source=alternatives.sources[row.source];
     csv.push([...common,referenceDate,source.date,'','','','','alternativa_pendiente:'+row.reason,...extraSourceFields(source)]);
    }
   }
  }
  years.push({year,available,pending:stations.length-available,dates:[...dates].sort(),
    ...(alternativeStations.size?{alternative_ranges:alternativeStations.size,alternative_dates:[...alternativeDates].sort(),pending_without_range:stations.length-available-alternativeStations.size}:{})});
 }
 assert.equal(years[0].available,stations.length);
 const gaps=beachRows.filter(row=>row.reference_unavailable).map(row=>({id:row.id,reason:row.reference_unavailable.reason}));
 const gapIds=new Set(gaps.map(gap=>gap.id));
 const modelTargets=new Map(model.targets.map(target=>[target.id,target]));
 for(const row of alternateRefs){
  assert.ok(gapIds.has(row.id)&&alternatives.sources[row.source].date.startsWith('2011-'));
  assert.deepEqual(row.origin,modelTargets.get(row.id).p);
  assert.ok(Number.isFinite(row.azimuth)&&Math.abs(row.azimuth)<=180);
  const source=alternatives.sources[row.source];
  csv.push([row.id,'','','','','2011','',source.date,'','','','','rango_de_orilla_alternativo_sin_referencia_fija',
   ...extraSourceFields(source,{referenceOffset:row.interval_m,origin:row.origin,azimuth:row.azimuth})]);
 }
 for(const row of altCatalogue){
  assert.ok(gapIds.has(row.id)&&row.sources.length&&new Set(row.sources).size===row.sources.length);
  for(const id of row.sources){
   const source=alternatives.sources[id];
   assert.ok(source);
   csv.push([row.id,'','','','',source.date.slice(0,4),'',source.date,'','','','','cobertura_de_catalogo_sin_lectura',...extraSourceFields(source)]);
  }
 }
 for(const gap of gaps)for(let year=2011;year<=review.last_year;year++){
  csv.push([gap.id,'','','','',year,'','','','','','',gap.reason]);
 }
 const path=(stage?work:'docs/qa/')+slug+'-punto-anio.csv';
 assert.ok(csv.every(row=>row.length===originalFields.length||row.length===csv[0].length),'Columnas del CSV desalineadas');
 writeFileSync(new URL(path,root),csv.map(row=>csvRow(csv[0].map((_,i)=>row[i]))).join('\n')+'\n');
 report.scopes.push({slug,stations:stations.length,segments:segments.length,reference_gaps:gaps,year_edition_frames:frames.size,station_frames_checked:checked,years,...(!stage?{alternative_reference_ranges:alternateRefs.length,alternative_comparison_ranges:alternateComparisons.length,alternative_catalogue_profiles:altCatalogue.length}:{})});
}
writeFileSync(new URL((stage?work:'docs/qa/')+'hunucma-yobain-audit.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.scopes.map(({reference_gaps,...s})=>({...s,reference_gaps:reference_gaps.length}))));
