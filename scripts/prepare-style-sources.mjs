import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root=fileURLToPath(new URL('../',import.meta.url));
const visited=new Set();
async function localModule(specifier,parent){
  const base=specifier.startsWith('@/')?resolve(root,specifier.slice(2)):specifier.startsWith('.')?resolve(dirname(parent),specifier):null;
  if(!base)return null;
  for(const candidate of [base,...['.tsx','.ts','.jsx','.js','.mjs','/index.tsx','/index.ts'].map(extension=>base+extension)]){
    if(!/\.[cm]?[jt]sx?$/.test(extname(candidate)))continue;
    try{await access(candidate);return candidate;}catch{}
  }
  throw new Error('Application source not found: '+specifier+' in '+parent);
}
async function visit(file){
  if(visited.has(file))return;visited.add(file);
  const text=await readFile(file,'utf8');
  // Includes local static imports, re-exports and literal lazy imports. JSON,
  // styles and third-party libraries contain no application utility classes.
  for(const item of ts.preProcessFile(text,true,true).importedFiles){
    if(/\.(json|css|svg|png|jpg|webp)$/.test(item.fileName))continue;
    const dependency=await localModule(item.fileName,file);if(dependency)await visit(dependency);
  }
}
for(const entry of ['deployment/public-map/main.tsx','app/page.tsx','app/layout.tsx'])await visit(resolve(root,entry));
const stylesheet=resolve(root,'app/generated-map-sources.css');
const paths=[...visited].sort((a,b)=>a.localeCompare(b)).map(file=>relative(dirname(stylesheet),file).replaceAll('\\','/'));
await writeFile(stylesheet,'/* Generated from the application import graph; includes lazy panels. */\n'+paths.map(path=>'@source '+JSON.stringify(path)+';').join('\n')+'\n');
