import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const revised=process.argv.includes('--revised');
const dataPath='public/data/shorelines/photo-alignment/'+(revised?'revised-data':'data')+'.json';
const [model,data,received]=await Promise.all([read('public/data/shorelines/scenario/model.json'),read(dataPath),read('public/data/history/esri-local-captures.json')]);
const reviews=await Promise.all((revised?['revised-visual-review']:['visual-review','position-review']).map(name=>read('public/data/shorelines/photo-alignment/'+name+'.json')));
const photoHash=createHash('sha256').update(await readFile(new URL(dataPath,root))).digest('hex');
const excluded=new Set();
const sourceReview=await read('public/data/shorelines/photo-alignment/'+(revised?'revised-source-review':'source-position-review')+'.json');
if(sourceReview.data_sha256!==photoHash)throw Error('Stale source-footprint review');
const sourceBlocked=new Set(sourceReview.blocked.filter(r=>r.kind==='photo').map(r=>r.release+':'+r.profile_id));
for(const review of reviews){if(review.data_sha256!==photoHash)throw Error('Stale positional review');for(const e of review.exclusions)excluded.add(e.profile_id+':'+e.capture);}
for(const row of data.targets)for(const r of row.readings)if(excluded.has(row.id+':'+r.capture))r.accepted=false;
const hash=createHash('sha256').update(await readFile(new URL('public/data/shorelines/scenario/model.json',root))).digest('hex');
if(hash!==data.model_sha256||data.targets.length!==model.targets.length)throw Error('Incompatible photo inventory');
const known=new Set(received.items.map(i=>i.releaseNum));
const grouped=new Map();
const compatible=new Map();
for(let i=0;i<model.targets.length;i++){
 const t=model.targets[i],row=data.targets[i];if(t.id!==row.id)throw Error('Profile order mismatch');
 // Retain only the received municipal assignments, not later nearest-town estimates.
 if(t.municipality_approximate)continue;
 const baseline=[2010,2011].find(year=>row.readings.some(r=>r.accepted&&data.captures[r.capture].date.startsWith(String(year))));
 for(const r of row.readings){
  const c=data.captures[r.capture];if(!c||c.resolution_m>1||r.releases.some(n=>!known.has(n)))continue;
  const key=[t.m,r.capture,...r.releases].join('|');
  const entry={municipality:t.m,date:c.date,year:Number(c.date.slice(0,4)),coordinates:t.p,profile_id:t.id,releases:r.releases,metadata:{date:Date.parse(c.date+'T00:00:00Z'),provider:c.provider,source:c.source,resolution:c.resolution_m,accuracy:c.accuracy_m}};
  if(!grouped.has(key))grouped.set(key,entry);
  // A dated image alone is not a compatible comparison. Both the accepted
  // 2010/2011 reference and the exact-year photographed position are needed.
  const acceptedReleases=r.releases.filter(release=>!sourceBlocked.has(release+':'+t.id));
  if(r.accepted&&baseline!==undefined&&entry.year>=baseline&&acceptedReleases.length){
   const compatibleKey=[t.m,r.capture,...acceptedReleases].join('|');
   const previous=compatible.get(compatibleKey);
   if(previous)previous.positions++;
   else compatible.set(compatibleKey,{...entry,releases:acceptedReleases,positions:1});
  }
 }
}
const captures=[...grouped.values()].sort((a,b)=>a.municipality.localeCompare(b.municipality)||a.date.localeCompare(b.date));
// Camera windows over the received coastal samples, never legal boundaries.
const coastal_views=[...new Set(captures.map(c=>c.municipality))].map(name=>{
 const points=model.targets.filter(t=>t.m===name&&!t.municipality_approximate).map(t=>t.p);
 const bounds=[Math.min(...points.map(p=>p[0]))-.01,Math.min(...points.map(p=>p[1]))-.01,Math.max(...points.map(p=>p[0]))+.01,Math.max(...points.map(p=>p[1]))+.01];
 return {name,bounds,coordinates:[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2]};
});
const compatible_captures=[...compatible.values()].sort((a,b)=>a.municipality.localeCompare(b.municipality)||a.date.localeCompare(b.date));
const places=await read('public/data/coastal-places.json');
const anchors=[...coastal_views.map(v=>({municipality:v.name,coordinates:v.coordinates})),...places.places.map(p=>({municipality:p.municipality,coordinates:p.coordinates})),{municipality:'Ixil',coordinates:[-89.4710383,21.3192508]}].map(anchor=>{
 const targets=model.targets.map((t,i)=>({t,i})).filter(({t})=>t.m===anchor.municipality&&!t.municipality_approximate).sort((a,b)=>Math.hypot(a.t.p[0]-anchor.coordinates[0],a.t.p[1]-anchor.coordinates[1])-Math.hypot(b.t.p[0]-anchor.coordinates[0],b.t.p[1]-anchor.coordinates[1]));
 const nearest=targets[0];if(!nearest)return null;
 return {...anchor,profile_id:nearest.t.id,profile_coordinates:nearest.t.p,captures:data.targets[nearest.i].readings.map(r=>({year:Number(data.captures[r.capture].date.slice(0,4)),releases:r.releases}))};
}).filter(Boolean);
const result={version:1,scope:'Point-sampled photographic comparisons; anchors retain local acquisition years by release, never full municipal coverage. Camera windows are not legal boundaries.',source_sha256:hash,photo_sha256:photoHash,coastal_views,captures,compatible_captures,anchors};
await writeFile(new URL('lib/generated/'+(revised?'municipal-photo-refined-catalogue':'municipal-photo-catalogue')+'.json',root),JSON.stringify(result));
console.log(JSON.stringify({captures:captures.length,compatible_captures:compatible_captures.length,municipalities:new Set(captures.map(c=>c.municipality)).size,bytes:Buffer.byteLength(JSON.stringify(result))}));
