import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url));
const refs={};
async function input(path){const bytes=await readFile(root+path);refs[path]=createHash('sha256').update(bytes).digest('hex');return JSON.parse(bytes);}
const index=await input('public/data/shorelines/series-2015/coverage-index.geojson');
const coverage=await input('public/data/shorelines/series-2015/coverage-years.json');
const coast=await input('public/data/shorelines/series-2015/reference-coast-2025.geojson');
const mx=111320*Math.cos(21.3*Math.PI/180),my=111320;
const dist2=(a,b)=>((a[0]-b[0])*mx)**2+((a[1]-b[1])*my)**2;
const sources=index.features.map((f,i)=>{assert.equal(f.properties.profile_id,coverage.profile_ids[i]);const c=f.geometry.coordinates;return {id:f.properties.profile_id,m:String(f.properties.municipality),p:[(c[0][0]+c.at(-1)[0])/2,(c[0][1]+c.at(-1)[1])/2]};});
const anchorYears=Object.keys(coverage.years).map(Number).filter(y=>coverage.years[y].status.some((c,i)=>c===1&&Number.isFinite(coverage.years[y].delta_m[i])));
const anchors=anchorYears.map(y=>coverage.years[y].delta_m.map((d,i)=>coverage.years[y].status[i]===1&&Number.isFinite(d)?d:null));
assert.ok(anchorYears.length>1);
// Directions are graphic axes, inferred from already received signed changes.
// They are not a validation of the physical coast/water indicator.
const vectors=new Map();
for(const y of [...anchorYears].reverse()){
 const data=await input(`public/data/shorelines/map/series-2015/annual/${y}.json`);
 for(const f of data.features){const p=f.properties,d=p.delta_m,c=f.geometry.coordinates;if(vectors.has(p.profile_id)||f.geometry.type!=='LineString'||c.length!==2||!Number.isFinite(d)||Math.abs(d)<.1)continue;let dx=(c[1][0]-c[0][0])*mx*Math.sign(d),dy=(c[1][1]-c[0][1])*my*Math.sign(d),n=Math.hypot(dx,dy);if(n>.01)vectors.set(p.profile_id,[dx/n,dy/n]);}
}
function nearest(point,items,count=5){const best=[];for(let i=0;i<items.length;i++){const d=dist2(point,items[i].p);if(best.length<count||d<best.at(-1).d){best.push({i,d});best.sort((a,b)=>a.d-b.d);if(best.length>count)best.pop();}}return best;}
const known=sources.filter(s=>vectors.has(s.id));assert.ok(known.length);
for(const s of sources)if(!vectors.has(s.id))vectors.set(s.id,vectors.get(known[nearest(s.p,known,1)[0].i].id));
const namedSources=sources.filter(s=>s.m!=='Atribución pendiente');
const targetMunicipality=s=>s.m==='Atribución pendiente'?namedSources[nearest(s.p,namedSources,1)[0].i].m:s.m;
const targets=sources.map(s=>({id:'SC-'+s.id,parent:s.id,m:targetMunicipality(s),p:s.p,v:vectors.get(s.id),type:'Playa · perfil regional',municipality_approximate:s.m==='Atribución pendiente'}));
let segments=0,cartographicAdded=0;
// Sample every physical coastline feature at100m, including vegetation and port
// outlines. Explicit cartographic closure lines are not physical shorelines.
for(let fi=0;fi<coast.features.length;fi++){
 const f=coast.features[fi];if(f.properties.SUBTIPO==='Línea de cierre')continue;segments++;
 const paths=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates;
 for(let part=0;part<paths.length;part++){
  const c=paths[part];let carry=0,serial=0;
  const add=(p,tangent)=>{const near=nearest(p,sources,1)[0];if(near.d<50**2)return;const src=sources[near.i],sea=vectors.get(src.id);let v=tangent?[-tangent[1],tangent[0]]:sea;if(v[0]*sea[0]+v[1]*sea[1]<0)v=v.map(x=>-x);targets.push({id:`SC-C${fi}-${part}-${serial++}`,parent:src.id,m:targetMunicipality(src),p,v,type:f.properties.SUBTIPO,municipality_approximate:true,cartographic_feature:fi});cartographicAdded++;};
  for(let j=1;j<c.length;j++){const a=c[j-1],b=c[j],dx=(b[0]-a[0])*mx,dy=(b[1]-a[1])*my,len=Math.hypot(dx,dy);if(!len)continue;const tangent=[dx/len,dy/len];if(j===1)add(a,tangent);for(let d=100-carry;d<=len;d+=100)add([a[0]+(b[0]-a[0])*d/len,a[1]+(b[1]-a[1])*d/len],tangent);carry=(carry+len)%100;if(j===c.length-1)add(b,tangent);}
 }
}
function medianWeighted(ids,point,yearIndex){const rows=ids.map(i=>({d:anchors[yearIndex][i],w:1/Math.max(250,Math.sqrt(dist2(point,sources[i].p)))**2})).sort((a,b)=>a.d-b.d);let t=0;const half=rows.reduce((s,r)=>s+r.w,0)/2;for(const r of rows){t+=r.w;if(t>=half)return r.d;}throw new Error('Empty support');}
const donors=anchors.map(values=>sources.map((s,i)=>({...s,index:i})).filter(s=>values[s.index]!==null));
const years=Array.from({length:17},(_,i)=>2010+i);
for(let i=0;i<targets.length;i++){
 const t=targets[i];t.support=donors.map(d=>nearest(t.p,d).map(n=>d[n.i].index));
 const values=t.support.map((ids,k)=>medianWeighted(ids,t.p,k));
 t.d=years.map(y=>{let hi=anchorYears.findIndex(v=>v>=y);if(hi<0)return Math.round(values.at(-1));if(hi===0||anchorYears[hi]===y)return Math.round(values[hi]);let lo=hi-1,w=(y-anchorYears[lo])/(anchorYears[hi]-anchorYears[lo]);return Math.round(values[lo]*(1-w)+values[hi]*w);});
 t.p=t.p.map(v=>Number(v.toFixed(8)));t.v=t.v.map(v=>Number(v.toFixed(8)));
 if(i%1000===0)console.log(JSON.stringify({prepared:i,total:targets.length}));
}
assert.equal(new Set(targets.map(t=>t.id)).size,targets.length);
for(const t of targets){assert.equal(t.d.length,17);assert.ok(t.d.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...t.v)-1)<1e-6);for(const ids of t.support)assert.ok(ids.length&&ids.every(i=>i>=0&&i<sources.length));}
const municipalities=[...new Set(targets.map(t=>t.m))].sort();assert.equal(municipalities.length,13);
const model={version:1,scenario_unvalidated:true,method:'coastwide-illustrative-idw-median-v1',years,anchorYears,sources,anchors,targets,coordinate_scale:[mx,my],source_hashes:refs,excluded_cartographic_closures:coast.features.length-segments,covered_physical_features:segments,cartographic_added:cartographicAdded,municipalities,rounding_m:1,cartographic_spacing_m:100};
const out=root+'public/data/shorelines/scenario/';await mkdir(out,{recursive:true});
const bytes=Buffer.from(JSON.stringify(model)),packed=gzipSync(bytes,{level:9});await writeFile(out+'model.json',bytes);await writeFile(out+'model.json.gz',packed);
await writeFile(root+'lib/generated/coastal-scenario-version.json',JSON.stringify({sha256:createHash('sha256').update(bytes).digest('hex')}));
const csv=[['profile_id','municipality','municipality_approximate','coast_type','year','annual_scenario_m','scenario_from_2010_m','scenario_unvalidated'].join(',')];
for(const t of targets){let sum=0;for(let j=0;j<years.length;j++){if(j>0)sum+=t.d[j];csv.push([t.id,t.m,t.municipality_approximate,t.type,years[j],t.d[j],sum,true].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(','));}}
await writeFile(out+'values.csv.gz',gzipSync(csv.join('\n')+'\n',{level:9}));
const receipt={scenario_unvalidated:true,targets:targets.length,years,anchorYears,municipalities,physical_cartographic_features:segments,cartographic_added:cartographicAdded,bytes:bytes.length,gzip_bytes:packed.length,source_hashes:refs};
await writeFile(out+'manifest.json',JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));
