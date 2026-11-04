import test from 'node:test';
import assert from 'node:assert/strict';
import {popupViewportPlacement} from '../lib/popup-viewport.ts';

const map={left:0,top:0,right:1200,bottom:800};
const safe={left:24,top:80,right:1176,bottom:680};
test('a nearby source stays open when its card would leave the visible map',()=>{
 const box={left:600,top:650,right:920,bottom:870};
 const result=popupViewportPlacement(box,safe,{x:750,y:830},map,{x:0,y:0});
 assert.equal(result.close,false);assert.equal(result.y,-190);
 assert(box.top+result.y>=safe.top);assert(box.bottom+result.y<=safe.bottom);
});
test('clamping is stable over repeated moves and restores the natural position',()=>{
 const first=popupViewportPlacement({left:-80,top:20,right:240,bottom:240},safe,{x:90,y:300},map,{x:0,y:0});
 assert.deepEqual(first,{close:false,x:104,y:60});
 const again=popupViewportPlacement({left:24,top:80,right:344,bottom:300},safe,{x:90,y:300},map,first);
 assert.deepEqual(again,first);
 const recentered=popupViewportPlacement({left:504,top:260,right:824,bottom:480},safe,{x:600,y:500},map,first);
 assert.deepEqual(recentered,{close:false,x:0,y:0});
});
test('a card closes only after its source is well outside the map',()=>{
 const box={left:300,top:100,right:620,bottom:320};
 for(const y of [-100,0,800,1100])assert.equal(popupViewportPlacement(box,safe,{x:500,y},map,{x:0,y:0}).close,false);
 assert.equal(popupViewportPlacement(box,safe,{x:500,y:1500},map,{x:0,y:0}).close,true);
 assert.equal(popupViewportPlacement(box,safe,{x:-1000,y:400},map,{x:0,y:0}).close,true);
});
test('expanded methods and narrow screens keep the card inside the safe area',()=>{
 const mobile={left:0,top:0,right:390,bottom:844},area={left:12,top:80,right:378,bottom:700};
 const box={left:260,top:-50,right:580,bottom:530};
 const result=popupViewportPlacement(box,area,{x:360,y:550},mobile,{x:0,y:0});
 assert.equal(result.close,false);
 assert(box.left+result.x>=area.left);assert(box.right+result.x<=area.right);
 assert(box.top+result.y>=area.top);assert(box.bottom+result.y<=area.bottom);
});
