import {build} from 'vite';
import {constants} from 'node:fs';
import {copyFile,mkdir,readdir,readFile,link,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// This public snapshot includes the exact prepared assets delivered to Pages.
// Rebuilding the interface does not require private working files or raw rasters.
const root=fileURLToPath(new URL('../',import.meta.url));
await import('./build-progreso-edition-coverage.mjs');
const output=resolve(root,'dist/public-map');
// Preserve the previous build. Finder may add .DS_Store during recursive cleanup.
try{
  await rename(output,resolve(root,'dist/public-map-anterior-'+Date.now()));
}catch(error){
  if(error.code!=='ENOENT')throw error;
}
await build({configFile:resolve(root,'vite.public.config.ts')});
const linkPublic=process.argv.includes('--link-public');
async function copy(relative=''){
  await mkdir(resolve(output,relative),{recursive:true});
  for(const entry of await readdir(resolve(root,'public',relative),{withFileTypes:true})){
    const path=relative?relative+'/'+entry.name:entry.name;
    if(entry.isDirectory())await copy(path);
    else if(entry.isFile()){
      if(linkPublic)await link(resolve(root,'public',path),resolve(output,path));
      else await copyFile(resolve(root,'public',path),resolve(output,path),constants.COPYFILE_FICLONE);
    }
    else throw new Error('Unexpected non-regular public asset: '+path);
  }
}
await copy();
const pages=JSON.parse(await readFile(resolve(root,'lib/generated/municipality-pages.json'),'utf8'));
const reviewedSlugs=new Set(JSON.parse(await readFile(resolve(root,'lib/generated/reviewed-municipality-slugs.json'),'utf8')));
const reviewedPages=pages.filter(page=>reviewedSlugs.has(page.slug));
for(const page of reviewedPages){
  const directory=resolve(output,'municipio',page.slug);
  await mkdir(directory,{recursive:true});
  await copyFile(resolve(output,'index.html'),resolve(directory,'index.html'));
}
console.log('Public map ready, including '+reviewedPages.length+' municipality pages.');
