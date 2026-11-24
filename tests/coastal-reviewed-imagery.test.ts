import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewedEsriMetadataZoom,reviewedEsriTileZoomLimits} from '../lib/coastal-reviewed-imagery.ts';
import {datedImageReviews} from '../lib/dated-image-reviews.ts';
import type {PhotoCoastData,PhotoCoastReading} from '../lib/photo-coast.ts';
import type {ScenarioTarget} from '../lib/coastal-scenario.ts';
import type {CoastalAuditReading} from '../lib/coastal-audit-reviews.ts';
const target=(id:string,m:string):ScenarioTarget=>({id,parent:id,m,p:[-90,21],v:[0,1],type:'beach',municipality_approximate:false,d:[],support:[]});
const dated=(release:number,detail=false):PhotoCoastReading=>({capture:0,offset_m:5,spread_m:null,releases:[release],accepted:true,reasons:[],detail_offsets:detail?[[release,6]]:[],manual_review:{id:datedImageReviews[0].method,source:'test:0',uncertainty_m:3}});
const photos=(rows:PhotoCoastData['targets']):PhotoCoastData=>({version:1,method:'fixture',field_validated:false,model_sha256:'a'.repeat(64),captures:[{date:'2025-01-01',provider:'Esri',source:'test',resolution_m:.5,accuracy_m:5}],targets:rows});

test('native levels are scoped to the municipality and edition, preserving a lower declared cap and data',()=>{
 const model={targets:[target('local','Progreso'),target('neighbour','Ixil')]};
 const data=photos([{id:'local',readings:[dated(10),dated(20,true),dated(30,true)]},{id:'neighbour',readings:[dated(99)]}]);
 const before=structuredClone(data),declared={30:16,40:17};
 assert.deepEqual(reviewedEsriTileZoomLimits(model,data,'Progreso',declared),{10:17,20:18,30:16,40:17});
 assert.deepEqual(data,before);
 assert.deepEqual(declared,{30:16,40:17});
});
test('one general-only interpretation caps the shared edition even if another point has detail',()=>{
 const model={targets:[target('first','Celestún'),target('second','Celestún')]};
 const data=photos([{id:'first',readings:[dated(20,true)]},{id:'second',readings:[dated(20)]}]);
 assert.deepEqual(reviewedEsriTileZoomLimits(model,data,'Celestún',undefined),{20:17});
});
test('current audit provenance supports z17 only; rejected or unattributed readings add no caps',()=>{
 const audited:CoastalAuditReading={...dated(60),manual_review:{id:'audit-fixture',source:'local:0',uncertainty_m:3},coastal_audit:{review_id:'audit-fixture',timestamp:'2026-11-09T00:00:00Z',date:'2025-01-01',source_release:60,old_offset_m:9,old_accepted:true,position_visual_interval_m:[4,6],evidence:[{path:'proof.jpg',sha256:'a'.repeat(64)}],metadata:{release:60,positionOffset:5,url:'proof',sha256:'b'.repeat(64),checks:[]},reason:'Reviewed boundary',history:[]}};
 const rejected={...dated(70),accepted:false,offset_m:null,reasons:['pending']};
 const unattributed={...dated(80),manual_review:undefined};
 const model={targets:[target('local','Yobaín')]};
 assert.deepEqual(reviewedEsriTileZoomLimits(model,photos([{id:'local',readings:[audited,rejected,unattributed]}]),'Yobaín',undefined),{60:17});
 const wrongEdition={...audited,releases:[61]};
 assert.equal(reviewedEsriTileZoomLimits(model,photos([{id:'local',readings:[wrongEdition]}]),'Yobaín',undefined),undefined);
});
test('metadata requests follow the same native source level during high zoom and ordinary overview',()=>{
 for(const display of [18,19,20])assert.equal(reviewedEsriMetadataZoom(display,17),17);
 assert.equal(reviewedEsriMetadataZoom(14,17),14);
 assert.equal(reviewedEsriMetadataZoom(18,undefined),18);
 assert.equal(reviewedEsriTileZoomLimits(null,null,null,undefined),undefined);
});
