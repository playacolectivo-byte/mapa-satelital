import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url));
const sourcePath='problems/gmw/annual-changes.geojson';
const manifestPath='problems/gmw/manifest.json';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Partition by the original year; never simplify or recalculate a feature. */
export async function prepareMangroveMap(){
  const sourceBytes=await readFile(resolve(root,'public/data',sourcePath));
  const manifestBytes=await readFile(resolve(root,'public/data',manifestPath));
  const source=JSON.parse(sourceBytes),manifest=JSON.parse(manifestBytes);
  assert.equal(source.type,'FeatureCollection');assert.ok(Array.isArray(source.features));
  assert.equal(manifest.source.version,'4.1.12');
  const years=[...new Set(manifest.annual_comparisons.map(entry=>entry.year))].sort((a,b)=>a-b);
  assert.ok(years.length && years.every(Number.isInteger));
  const partition=new Map(years.map(year=>[year,[]]));
  for(const feature of source.features){
    const year=feature.properties?.year;
    assert.ok(partition.has(year),'Feature year must exist in the original provider manifest');
    assert.equal(feature.properties.source_id,'GMW4112');
    partition.get(year).push(feature);
  }
  const directory=resolve(root,'public/data/problems/gmw/map/years');
  await mkdir(directory,{recursive:true});
  const outputs=[];
  for(const [year,features] of partition){
    const path='problems/gmw/map/years/'+year+'.geojson';
    const body=Buffer.from(JSON.stringify({...source,features}));
    // Deep equality includes every feature attribute, native coordinate and ID.
    const received=JSON.parse(body);
    assert.deepEqual(received.features,source.features.filter(feature=>feature.properties.year===year));
    assert.deepEqual(Object.fromEntries(Object.entries(received).filter(([key])=>key!=='features')),Object.fromEntries(Object.entries(source).filter(([key])=>key!=='features')));
    await writeFile(resolve(root,'public/data',path),body);
    outputs.push({year,path,features:features.length,bytes:body.length,sha256:hash(body)});
  }
  assert.equal(outputs.reduce((n,entry)=>n+entry.features,0),source.features.length);
  // The provider's complete metadata and original files remain authoritative.
  const deliveryPath='problems/gmw/map/manifest.json';
  const delivery={version:1,source_version:manifest.source.version,source:manifest.source,source_manifest_path:manifestPath,source_manifest_sha256:hash(manifestBytes),source_geojson_path:sourcePath,source_geojson_sha256:hash(sourceBytes),partition:'Original year, original feature order within each year; no coordinate/attribute changes',years:outputs};
  await writeFile(resolve(root,'public/data',deliveryPath),JSON.stringify(delivery,null,2)+'\n');
  assert.equal(hash(await readFile(resolve(root,'public/data',sourcePath))),hash(sourceBytes));
  assert.equal(hash(await readFile(resolve(root,'public/data',manifestPath))),hash(manifestBytes));
  return {paths:[deliveryPath,...outputs.map(entry=>entry.path)],delivery};
}

if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify((await prepareMangroveMap()).delivery,null,2));
