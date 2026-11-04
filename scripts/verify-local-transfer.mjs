import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const manifest=JSON.parse(await readFile(path.join(root,'MANIFIESTO_LOCAL.json'),'utf8'));
let checked=0;
for(const entry of manifest.files){
  const file=path.resolve(root,entry.path);
  if(!file.startsWith(root+path.sep))throw new Error('Ruta fuera del paquete');
  const raw=await readFile(file);
  if(raw.length!==entry.bytes||createHash('sha256').update(raw).digest('hex')!==entry.sha256)throw new Error('Archivo distinto o incompleto: '+entry.path);
  checked++;
}
console.log(JSON.stringify({status:'passed',checked_files:checked,source_commit:manifest.source_commit,raw_tiff_crops:manifest.raw_tiff_crops,scientific_data_changed:false}));
