import {build} from 'vite';
import {constants} from 'node:fs';
import {copyFile,mkdir,readdir,readFile,link} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// This public snapshot includes the exact prepared assets delivered to Pages.
// Rebuilding the interface does not require private working files or raw rasters.
const root=fileURLToPath(new URL('../',import.meta.url));
await build({configFile:resolve(root,'vite.public.config.ts')});
const output=resolve(root,'dist/public-map');
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
for(const page of pages){
  const directory=resolve(output,'municipio',page.slug);
  await mkdir(directory,{recursive:true});
  await copyFile(resolve(output,'index.html'),resolve(directory,'index.html'));
}
console.log('Public map ready, including '+pages.length+' municipality pages.');
