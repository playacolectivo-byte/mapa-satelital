import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { readdir, rm, readFile, stat, mkdir, copyFile, symlink, link } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { constants } from 'node:fs';
import {execFileSync} from 'node:child_process';
const localPreview=process.argv.includes('--local-preview');
const prepared=process.argv.includes('--prepared');
const hardlinkPrepared=process.argv.includes('--hardlink-prepared');
if(hardlinkPrepared&&!prepared)throw new Error('--hardlink-prepared requires frozen --prepared data');
const outFlag=process.argv.indexOf('--out-dir');
const outputDirectory=outFlag<0?undefined:process.argv[outFlag+1];
if(outFlag>=0&&(!outputDirectory||outputDirectory.startsWith('--')))throw new Error('Missing --out-dir value');
// UI-only local iterations reuse the already prepared, verified data. They
// must not rewrite hundreds of MB or create another copy on a nearly full Mac.
if(!localPreview&&!prepared){await import('./prepare-map-delivery.mjs');await import('./build-coastwide-scenario.mjs');await import('./build-municipal-photo-catalogue.mjs');execFileSync(fileURLToPath(new URL('../.coast-python/bin/python',import.meta.url)),[fileURLToPath(new URL('./build-municipal-pages.py',import.meta.url))],{stdio:'inherit'});}
await build({ configFile: fileURLToPath(new URL('../vite.public.config.ts', import.meta.url)),...(outputDirectory?{build:{outDir:resolve(outputDirectory)}}:{}) });
// Copy-on-write files on APFS keep the portable output independent without
// temporarily duplicating hundreds of MB. Other filesystems use normal copies.
// Exclude inactive history caches before copying; never touch public originals.
const sourcePublic=fileURLToPath(new URL('../public/',import.meta.url));
const targetPublic=outputDirectory?resolve(outputDirectory):fileURLToPath(new URL('../dist/public-map/',import.meta.url));
// The user explicitly enabled the received partial INEGI orthophotos again.
// Include their six actual tile trees; inactive numeric caches stay excluded.
const partialInegi=JSON.parse(await readFile(resolve(sourcePublic,'data/history/manifest.json'),'utf8'));
const activeHistoryFolders=new Set(partialInegi.frames.map(frame=>frame.tiles?.match(/^\/data\/history\/([^/]+)\//)?.[1]).filter(Boolean));
async function copyPublic(relative='') {
  await mkdir(resolve(targetPublic,relative),{recursive:true});
  for(const entry of await readdir(resolve(sourcePublic,relative),{withFileTypes:true})) {
    if(relative==='data/history' && entry.isDirectory() && /^\d+$/.test(entry.name) && !activeHistoryFolders.has(entry.name))continue;
    const path=relative?relative+'/'+entry.name:entry.name;
    if(entry.isDirectory())await copyPublic(path);
    else if(entry.isFile()){
      // The interactive map requests its small indices and lazy detail chunks.
      // Preserve the original scientific export in public and deliver its
      // lossless gzip, avoiding a second uncompressed copy in the web package.
      if(/^data\/shorelines\/series-2015\/(annual|reference2015|reference2020)$/.test(relative)&&entry.name.endsWith('.geojson')){
        const [plain,packed]=await Promise.all([readFile(resolve(sourcePublic,path)),readFile(resolve(sourcePublic,path+'.gz'))]);
        assert.deepEqual(gunzipSync(packed),plain);
        continue;
      }
      if(hardlinkPrepared)await link(resolve(sourcePublic,path),resolve(targetPublic,path));
      else await copyFile(resolve(sourcePublic,path),resolve(targetPublic,path),constants.COPYFILE_FICLONE);
    }
  }
}
if(localPreview){
  for(const entry of await readdir(sourcePublic))await symlink(resolve(sourcePublic,entry),resolve(targetPublic,entry));
  console.log('Local preview ready: public assets linked to originals; not a portable publication package.');
}else{
await copyPublic();
// Old, inactive raster tile caches are not requested by this map. Keep all
// originals in public/data/history; omit only their copies from this output.
// This also keeps the ready-to-upload package below the dashboard's file limit.
const history = resolve(targetPublic,'data/history');
for (const entry of await readdir(history, { withFileTypes: true })) {
    if (entry.isDirectory() && /^\d+$/.test(entry.name) && !activeHistoryFolders.has(entry.name))
    await rm(resolve(history, entry.name), { recursive: true });
}
// The full export is downloadable losslessly as gzip. The interactive viewer
// uses its small index and content-addressed details, never this raw export.
const regional=resolve(targetPublic,'data/shorelines/regional-2025-2026.geojson');
if((await stat(regional)).size>25*1024*1024){
  const [plain,packed]=await Promise.all([readFile(regional),readFile(regional+'.gz')]);
  assert.deepEqual(gunzipSync(packed),plain);
  await rm(regional);
}
}

// Real static municipality entry points support refresh/deep links on Pages.
const pages=JSON.parse(await readFile(new URL('../lib/generated/municipality-pages.json',import.meta.url),'utf8'));
for(const page of pages){const dir=resolve(targetPublic,'municipio',page.slug);await mkdir(dir,{recursive:true});await copyFile(resolve(targetPublic,'index.html'),resolve(dir,'index.html'));}
