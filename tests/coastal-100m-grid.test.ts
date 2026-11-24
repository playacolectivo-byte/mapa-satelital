import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyCoastal100mGrid,coastalLocalDistance,intersectGridNormal,ixilSamplingSegments,sampleObservedCoast,type Coastal100mGrid} from '../lib/coastal-100m-grid.ts';
import {coastalGridSpacingLinks,coastalSpacingLinks} from '../lib/coastal-spacing.ts';
import type {CoastalAnalysisData} from '../lib/coastal-analysis.ts';

const grid:Coastal100mGrid={version:1,spacing_m:100,method:'fixture',segments:[{id:'P',municipality:'Progreso',stations:[{id:'G0',chainage_m:0,coordinate:[-89.5,21],left_profile_id:'A',right_profile_id:'B',fraction:0,axis:[0,1]},{id:'G1',chainage_m:100,coordinate:[-89.4995,21],left_profile_id:'A',right_profile_id:'B',fraction:.5,axis:[0,1]}]}]};
const frame=(year=2025):CoastalAnalysisData=>({type:'FeatureCollection',features:['A','B'].map((id,i)=>({type:'Feature',id,geometry:{type:'LineString',coordinates:[[-89.5+i*.001,21],[-89.5+i*.001+.00005,21.0001]]},properties:{profile_id:id,municipality:'Progreso',year,baseline_year:2011,date_before:'2011-08-01',baseline_fixed:true,delta_m:11,estimated:false,photo_interpretation:true,date_after:'2025-02-13',photo_sources:[{date:'2025-02-13',provider:'Maxar',source:'WV03'}],photo_metadata_points:[]}}))});

test('the fixed grid intersects the annual coastline normal instead of transplanting offsets or shifting sideways',()=>{
 const source=frame(),copy=structuredClone(source),sampled=applyCoastal100mGrid(source,grid);
 assert.deepEqual(source,copy);assert.deepEqual(sampled.features.map(f=>f.id),['G0','G1']);
 const f=sampled.features[1];assert.ok(f.geometry.type==='LineString');
 assert.equal(f.geometry.coordinates[1][0],-89.4995);assert.ok(Math.abs(f.geometry.coordinates[1][1]-21.0001)<1e-10);
 assert.ok(Math.abs(Number(f.properties.delta_m)-coastalLocalDistance([-89.4995,21],[-89.4995,21.0001]))<1e-5);
 assert.equal(f.properties.estimated,true);assert.equal(f.properties.grid_spatial_interpolation,true);
 assert.deepEqual(f.properties.grid_source_profile_ids,['A','B']);
});

test('missing controls, source seams and an unbracketed normal never yield metres',()=>{
 for(const mutate of [(x:CoastalAnalysisData)=>{x.features[1].properties.photo_interpretation=false;},(x:CoastalAnalysisData)=>{x.features[1].properties.date_after='2024-01-01';},(x:CoastalAnalysisData)=>{x.features[1].properties.photo_sources=[{date:'2025-02-13',provider:'Maxar',source:'GE01'}];}]){
  const source=frame();mutate(source);const result=applyCoastal100mGrid(source,grid).features[1];assert.equal(result.properties.delta_m,null);assert.equal(result.properties.photo_review_pending,true);
 }
 assert.equal(intersectGridNormal([-89.5,21],[0,1],[-89.49,21.001],[-89.48,21.001]),null);
 assert.equal(intersectGridNormal([-89.5,21],[0,1],[-89.5,21.001],[-89.5,21.002]),null);
 const missing=frame();missing.features.pop();const station=applyCoastal100mGrid(missing,grid).features.find(f=>f.id==='G1')!;assert.ok(station);assert.equal(station.properties.delta_m,null);
 const unknown=applyCoastal100mGrid(frame(),grid).features.find(f=>f.id==='G1')!;assert.equal(unknown.properties.registration_proxy_m,null);assert.equal(unknown.properties.direction_unresolved,true);
 const unidentified=frame();for(const f of unidentified.features){delete f.properties.date_after;f.properties.photo_sources=[{}];}assert.equal(applyCoastal100mGrid(unidentified,grid).features[1].properties.delta_m,null);
 const moved=frame();const staleGrid=structuredClone(grid);staleGrid.segments[0].stations[1].coordinate[1]+=.00001;assert.equal(applyCoastal100mGrid(moved,staleGrid).features[1].properties.delta_m,null);
});

test('2011 stations stay fixed; orphan reference locators remain archived rather than adding off-grid points',()=>{
 const source=frame(2011);for(const f of source.features){f.properties.reference_only=true;f.properties.date_after='2011-08-01';f.properties.photo_sources=[{date:'2011-08-01',provider:'Maxar',source:'WV03'}];}
 source.features.push({type:'Feature',id:'pending',geometry:{type:'Point',coordinates:[-89.6,21]},properties:{profile_id:'pending',municipality:'Progreso',baseline_fixed:false,delta_m:null}});
 const baseline=applyCoastal100mGrid(source,grid),later=applyCoastal100mGrid(frame(),grid);
 assert.ok(source.features.some(f=>f.id==='pending'));assert.ok(!baseline.features.some(f=>f.id==='pending'));
 for(const station of grid.segments[0].stations){const a=baseline.features.find(f=>f.id===station.id)!,b=later.features.find(f=>f.id===station.id)!;assert.deepEqual(a.properties.baseline_coordinate,b.properties.baseline_coordinate);assert.equal(a.properties.delta_m,0);}
});

test('100 m labels follow consecutive chainage stations; unrelated five-metre controls cannot be labelled 100 m',()=>{
 const layer=applyCoastal100mGrid(frame(),grid);const links=coastalGridSpacingLinks(layer);assert.equal(links.length,1);assert.equal(links[0].chainage_m,100);
 const gap=structuredClone(layer);gap.features[1].properties.grid_chainage_m=200;assert.equal(coastalGridSpacingLinks(gap).length,0);
 const close=coastalSpacingLinks([{id:'a',coordinate:[-89.5,21]},{id:'b',coordinate:[-89.49995,21]}]);assert.ok(close[0].distance_m>5&&close[0].distance_m<6);assert.equal(close[0].chainage_m,undefined);
});

test('a detailed photographed baseline may curve away from its controls without transplanting their old displacements',()=>{
 const curved=structuredClone(grid),s=curved.segments[0].stations[1];s.coordinate[1]-=.00005;s.control_reference_coordinates=[[-89.5,21],[-89.499,21]];
 const source=frame(),after=applyCoastal100mGrid(source,curved).features[1];assert.ok(after.geometry.type==='LineString');assert.deepEqual(after.geometry.coordinates[0],s.coordinate);assert.equal(after.geometry.coordinates[1][1],21.0001);assert.ok(Number(after.properties.delta_m)>16);
 const stale=frame();assert.ok(stale.features[1].geometry.type==='LineString');stale.features[1].geometry.coordinates[0][1]+=.00001;assert.equal(applyCoastal100mGrid(stale,curved).features[1].properties.delta_m,null);
});

test('a newly audited control stays exact and cannot supply a newly interpolated grid endpoint',()=>{
 const source=frame(),other=frame();
 for(const [i,f] of other.features.entries()){f.id=i?'D':'C';f.properties.profile_id=f.id;if(f.geometry.type==='LineString')for(const p of f.geometry.coordinates)p[0]+=.01;}
 source.features.push(...other.features);
 const expanded=structuredClone(grid),station=structuredClone(grid.segments[0].stations[1]);
 station.id='G2';station.left_profile_id='C';station.right_profile_id='D';station.coordinate[0]+=.01;
 expanded.segments[0].stations.push(station);
 const before=applyCoastal100mGrid(source,expanded);
 source.features[0].properties.photo_audit_preserve_control=true;
 source.features[0].properties.photo_endpoint_audit={review_id:'fixture',capture:1,source_release:201,accepted:true};
 const original=structuredClone(source.features[0]),after=applyCoastal100mGrid(source,expanded);
 assert.deepEqual(after.features.find(f=>f.id==='A'),original);
 assert.equal(after.features.some(f=>f.id==='G0'||f.id==='G1'),false);
 assert.deepEqual(after.features.find(f=>f.id==='G2'),before.features.find(f=>f.id==='G2'));
 const pending=structuredClone(source);pending.features[0].geometry={type:'Point',coordinates:[-89.5,21]};pending.features[0].properties.delta_m=null;
 assert.deepEqual(applyCoastal100mGrid(pending,expanded).features.find(f=>f.id==='A'),pending.features[0]);
});

test('a sampling station shows one compatible photographed profile and never moves its endpoints',()=>{
 const source=frame();
 for(const f of source.features){
  f.properties.photo_start_kind='photo';
  f.properties.photo_end_kind='photo';
 }
 const a=source.features[0], b=source.features[1];
 const aDuplicate=structuredClone(a);
 aDuplicate.id='better-reviewed';
 aDuplicate.properties.profile_id=aDuplicate.id;
 aDuplicate.properties.photo_endpoint_audit={review_id:'fixture'};
 source.features.push(aDuplicate);
 const distant={...b,id:'far-from-station',geometry:{type:'LineString' as const,coordinates:[[-89.497,21],[-89.497,21.0001]]}};
 const pending={...b,id:'pending',properties:{...b.properties,photo_review_pending:true}};
 source.features.push(distant,pending);
 const sampling=[{id:'segment',municipality:'Progreso',stations:[
  {id:'start',coordinate:[-89.5,21] as [number,number],chainage_m:0},
  {id:'next',coordinate:[-89.49905,21] as [number,number],chainage_m:100},
  {id:'gap',coordinate:[-89.49809,21] as [number,number],chainage_m:200},
 ]}];
 const before=structuredClone(source);
 const output=sampleObservedCoast(source,sampling,2025);
 assert.deepEqual(output.features.map(f=>f.id),['better-reviewed','B','gap']);
 assert.deepEqual(output.features[0].geometry,aDuplicate.geometry);
 assert.deepEqual(output.features[1].geometry,b.geometry);
 assert.equal(output.features[1].properties.delta_m,b.properties.delta_m);
 assert.equal(output.features[2].properties.delta_m,null);
 assert.equal(output.features[2].properties.sampling_gap,true);
 assert.deepEqual(source,before);
 const links=coastalGridSpacingLinks(output);
 assert.deepEqual(links.map(link=>[link.from.id,link.to.id,link.chainage_m,link.pending]),[['start','next',100,false],['next','gap',100,true]]);
});

test('two nearby endpoints cannot draw separate results at adjacent sampled stations',()=>{
 const source=frame();
 for(const f of source.features){
  f.properties.photo_start_kind='photo';
  f.properties.photo_end_kind='photo';
 }
 if(source.features[1].geometry.type!=='LineString')throw Error('Missing fixture');
 source.features[1].geometry.coordinates[1]=[-89.4998,21.0001];
 const stations=[
  {id:'left',coordinate:[-89.5,21] as [number,number],chainage_m:0},
  {id:'right',coordinate:[-89.499,21] as [number,number],chainage_m:100},
 ];
 const sampled=sampleObservedCoast(source,[{id:'segment',municipality:'Progreso',stations}],2025);
 assert.deepEqual(sampled.features.map(f=>f.id),['A','right']);
 assert.equal(sampled.features[1].properties.delta_m,null);
});

test('Ixil station chainage uses the fixed reference corridor and stops over a large gap',()=>{
 const references=[
  {coordinate:[-89.498,21] as [number,number],municipality:'Ixil'},
  {coordinate:[-89.5,21] as [number,number],municipality:'Progreso'},
  {coordinate:[-89.499,21] as [number,number],municipality:'Ixil'},
  {coordinate:[-89.49,21] as [number,number],municipality:'Dzemul'},
 ];
 const segments=ixilSamplingSegments(references);
 assert.deepEqual(segments.map(segment=>segment.stations.map(station=>station.chainage_m)),[[0,100,200],[0]]);
 assert.deepEqual(segments.map(segment=>segment.stations[0].municipality),['Progreso','Dzemul']);
});

test('a requested reference year keeps other dated baselines pending',()=>{
 const source=frame();
 for(const f of source.features){
  f.properties.photo_start_kind='photo';
  f.properties.photo_end_kind='photo';
 }
 source.features[0].properties.date_before='2011-08-01';
 source.features[1].properties.date_before='2012-12-15';
 const stations=[
  {id:'left',coordinate:[-89.5,21] as [number,number],chainage_m:0},
  {id:'right',coordinate:[-89.499,21] as [number,number],chainage_m:100},
 ];
 const segments=[{id:'progreso',municipality:'Progreso',stations}];
 const comparison=sampleObservedCoast(source,segments,2025,2011);
 assert.deepEqual(comparison.features.map(f=>f.id),['A','right']);
 assert.equal(comparison.features[1].properties.sampling_gap,true);
 assert.deepEqual(sampleObservedCoast(source,segments,2025).features.map(f=>f.id),['A','B']);
});
