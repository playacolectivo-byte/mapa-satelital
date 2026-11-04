import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { gzipSync, gunzipSync } from 'node:zlib';

const root=fileURLToPath(new URL('../',import.meta.url));
const base=resolve(root,'public/data/shorelines');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const keys=['record_id','profile_id','transect_id','segment_id','delta_m','apparent_change_toward_water_m','baseline_year','comparison_start_year','comparison_end_year','comparison_year','year','date','sensor','native_resolution_m','resolution_m','estimated','spatial_estimate','position_is_estimated','context_review','quality','direction_unresolved','persistence_screen','experimental_analysis','homologation_pending','reference_only','baseline_estimated','baseline_is_estimated','model_before','model_after','municipality'];

/** Small geometry index first; complete, unchanged scientific attributes on click. */
export async function prepareCoastalMap() {
  const manifest=JSON.parse(await readFile(resolve(base,'manifest.json'),'utf8'));
  const annual=JSON.parse(await readFile(resolve(base,'annual/manifest.json'),'utf8'));
  const reference=JSON.parse(await readFile(resolve(base,'reference-2010/manifest.json'),'utf8'));
  let series=[];
  try{const recent=JSON.parse(await readFile(resolve(base,'series-2015/manifest.json'),'utf8'));series=recent.periods.flatMap(p=>['annual','reference2015','reference2020'].filter(mode=>p[mode]).map(mode=>'series-2015/'+p[mode].source));}catch(error){if(error.code!=='ENOENT')throw error;}
  const inputs=[...new Set(['regional-2025-2026.geojson',...manifest.years.map(year=>'years/'+year+'.geojson'),...annual.periods.filter(p=>p.features&&p.source).map(p=>p.source),...reference.periods.filter(p=>p.features&&p.source).map(p=>p.source),...series])];
  const output=resolve(base,'map');await mkdir(resolve(output,'details'),{recursive:true});
  const report=[];
  for(const input of inputs) {
    const bytes=await readFile(resolve(base,input)); const source=JSON.parse(bytes); const features=[];
    if(input==='regional-2025-2026.geojson'||input.startsWith('series-2015/')){
      const packed=gzipSync(bytes,{level:9});assert.deepEqual(gunzipSync(packed),bytes);
      await writeFile(resolve(base,input+'.gz'),packed);
    }
    const stem=input.replace(/\.geojson$/,'.json');let detailBytes=0;
    for(let start=0;start<source.features.length;) {
      const part=[];let chunkBytes=16;
      while(start+part.length<source.features.length && part.length<64){
        const feature=source.features[start+part.length];
        const bytes=Buffer.byteLength(JSON.stringify(feature.properties))+32;
        if(part.length && chunkBytes+bytes>256*1024)break;
        chunkBytes+=bytes;part.push(feature);
      }
      const records=Object.fromEntries(part.map((feature,index)=>[String(start+index),feature.properties]));
      const body=Buffer.from(JSON.stringify({records})); const digest=hash(body);
      await writeFile(resolve(output,'details',digest+'.json'),body);detailBytes+=body.length;
      const packed=gzipSync(body,{level:9});assert.deepEqual(gunzipSync(packed),body);
      await writeFile(resolve(output,'details',digest+'.json.gz'),packed);
      // Validate preservation before discarding any attributes from the map index.
      assert.deepEqual(JSON.parse(body).records,records);
      part.forEach((feature,index)=>{
        const properties=Object.fromEntries(keys.filter(key=>feature.properties[key]!==undefined).map(key=>[key,feature.properties[key]]));
        properties.detail_url='/data/shorelines/map/details/'+digest+'.json';
        properties.detail_key=String(start+index);
        const compact={...feature,properties};
        assert.deepEqual(compact.geometry,feature.geometry);
        for(const key of keys) if(key in properties)assert.deepEqual(properties[key],feature.properties[key]);
        features.push(compact);
      });
      start+=part.length;
    }
    const result=Buffer.from(JSON.stringify({type:'FeatureCollection',metadata:{source_sha256:hash(bytes),features:features.length,detail_policy:'Full unchanged attributes loaded on demand; source geometry unchanged'},features}));
    await mkdir(resolve(output,stem,'..'),{recursive:true});
    await writeFile(resolve(output,stem),result);
    report.push({source:input,features:features.length,source_bytes:bytes.length,map_index_bytes:result.length,details_bytes:detailBytes,reduction_percent:Math.round((1-result.length/bytes.length)*100)});
  }
  await writeFile(resolve(output,'delivery.json'),JSON.stringify({format:1,layers:report},null,2));
  // These are generated detail caches, never scientific source files. Keep
  // every chunk referenced by any retained map index, including older indices.
  // Prune only recognized content hashes after all current indices are written.
  const referenced=new Set();
  async function collect(directory){
    for(const entry of await readdir(directory,{withFileTypes:true})){
      if(entry.name==='details')continue;
      const path=resolve(directory,entry.name);
      if(entry.isDirectory())await collect(path);
      else if(entry.isFile()&&entry.name.endsWith('.json')){
        const body=await readFile(path,'utf8');
        for(const match of body.matchAll(/\/data\/shorelines\/map\/details\/([a-f0-9]{64})\.json/g))referenced.add(match[1]);
      }
    }
  }
  await collect(output);
  const pruned=[];
  for(const entry of await readdir(resolve(output,'details'),{withFileTypes:true})){
    const match=/^([a-f0-9]{64})\.json(?:\.gz)?$/.exec(entry.name);
    if(entry.isFile()&&match&&!referenced.has(match[1])){
      await rm(resolve(output,'details',entry.name));pruned.push(entry.name);
    }
  }
  await writeFile(resolve(output,'generated-cache-pruning.json'),JSON.stringify({policy:'Only generated hash chunks without a reference in any retained map index',referenced_chunks:referenced.size,pruned},null,2));
  return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(await prepareCoastalMap()));
