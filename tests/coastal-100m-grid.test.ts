import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyCoastal100mGrid,coastalLocalDistance,intersectGridNormal,type Coastal100mGrid} from '../lib/coastal-100m-grid.ts';
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
