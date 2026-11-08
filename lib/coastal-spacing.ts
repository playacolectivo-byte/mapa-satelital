/** Neighbour links for a nominal sampling overlay, not new measurements.
 * Build once per displayed result layer; a kd-tree avoids a quadratic scan
 * over the full coast on every pan. Every distinct point gets a neighbour. */
export type SpacingPosition={id:string;coordinate:[number,number]};
import {coastalLocalDistance} from './coastal-100m-grid.ts';
import type {CoastalAnalysisData} from './coastal-analysis.ts';
export type SpacingLink={from:SpacingPosition;to:SpacingPosition;distance_m:number;chainage_m?:number};

export function coastalGridSpacingLinks(layer:CoastalAnalysisData):SpacingLink[]{
 const segments=new Map<string,{position:SpacingPosition;chainage:number}[]>();
 for(const f of layer.features){
  const p=f.properties;if(p.grid_spacing_m!==100||typeof p.grid_segment!=='string'||typeof p.grid_chainage_m!=='number'||!Array.isArray(p.baseline_coordinate))continue;
  const rows=segments.get(p.grid_segment)??[];rows.push({position:{id:String(p.profile_id),coordinate:p.baseline_coordinate as [number,number]},chainage:p.grid_chainage_m});segments.set(p.grid_segment,rows);
 }
 const links:SpacingLink[]=[];
 for(const rows of segments.values()){
  rows.sort((a,b)=>a.chainage-b.chainage);
  for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i],interval=b.chainage-a.chainage;if(Math.abs(interval-100)>.001)continue;links.push({from:a.position,to:b.position,distance_m:coastalLocalDistance(a.position.coordinate,b.position.coordinate),chainage_m:interval});}
 }
 return links;
}
type Point=SpacingPosition&{index:number;x:number;y:number};
type Node={point:Point;axis:0|1;left:Node|null;right:Node|null};
export function coastalSpacingLinks(positions:SpacingPosition[],maximumDistanceMeters=Infinity):SpacingLink[]{
 if(positions.length<2)return [];
 const scaleX=111320*Math.cos(21.3*Math.PI/180);
 const points=positions.map((p,index)=>({...p,index,x:p.coordinate[0]*scaleX,y:p.coordinate[1]*111320}));
 const tree=(items:Point[],depth=0):Node|null=>{
  if(!items.length)return null;
  const axis=depth%2 as 0|1,key=axis?'y':'x';items.sort((a,b)=>a[key]-b[key]);const mid=items.length>>1;
  return {point:items[mid],axis,left:tree(items.slice(0,mid),depth+1),right:tree(items.slice(mid+1),depth+1)};
 };
 const root=tree([...points]);
 const nearest=(point:Point)=>{
  const best:{point:Point;d:number}[]=[];
  const visit=(node:Node|null)=>{
   if(!node)return;
   const dx=node.point.x-point.x,dy=node.point.y-point.y,d=dx*dx+dy*dy;
   if(node.point.index!==point.index&&d>.01){best.push({point:node.point,d});best.sort((a,b)=>a.d-b.d);if(best.length>2)best.pop();}
   const offset=node.axis?point.y-node.point.y:point.x-node.point.x;
   visit(offset<0?node.left:node.right);
   if(best.length<2||offset*offset<=best[best.length-1].d)visit(offset<0?node.right:node.left);
  };visit(root);return best;
 };
 const links:SpacingLink[]=[],seen=new Set<string>();
 for(const point of points){
  const neighbours=nearest(point);
  for(let i=0;i<neighbours.length;i++){
   if(neighbours[i].d>maximumDistanceMeters**2)continue;
   const next=neighbours[i].point;
   if(i===1){
    const first=neighbours[0].point,ax=first.x-point.x,ay=first.y-point.y,bx=next.x-point.x,by=next.y-point.y;
    // Do not draw a second link that skips the nearer point on the same side.
    if((ax*bx+ay*by)/Math.sqrt(neighbours[0].d*neighbours[1].d)>.5)continue;
   }
   const key=[point.index,next.index].sort((a,b)=>a-b).join(':');if(seen.has(key))continue;seen.add(key);
   links.push({from:point,to:next,distance_m:coastalLocalDistance(point.coordinate,next.coordinate)});
  }
 }
 return links;
}
