import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const write=(path,data)=>{const bytes=Buffer.from(JSON.stringify(data)+'\n');writeFileSync(new URL(path,root),bytes);return bytes;};
const neighbours=read('lib/generated/municipal-neighbours.json');
const views=read('lib/generated/municipal-photo-refined-catalogue.json').coastal_views;
const pages=read('lib/generated/municipality-pages.json');
for(const page of pages){
 const links=neighbours[page.name];if(!links)continue;
 const folder='public/data/municipalities/'+page.slug+'/';
 const config=read(folder+'config.json'),index=read(folder+'index.json');
 const bounds=views.find(v=>v.name===page.name).bounds;
 const nav=[bounds[0]-.012,bounds[1]-.012,bounds[2]+.012,bounds[3]+.012];
 page.bounds=[...bounds];page.navigation_bounds=nav;
 index.municipality=page;
 for(const key of ['focus_bounds','operational_bounds','overview_bounds'])config[key]=[...bounds];
 config.navigation_bounds=[...nav];config.neighbour_places=links;
 delete config.municipality_view_west;delete config.municipality_view_bounds;
 const bytes=write(folder+'config.json',config);
 writeFileSync(new URL(folder+'config.json.gz',root),gzipSync(bytes,{mtime:0}));
 const asset=index.assets['config.json'];asset.sha256=createHash('sha256').update(bytes).digest('hex');asset.bytes=bytes.length;
 write(folder+'index.json',index);
 console.log(page.name+': restored navigation, '+links.length+' neighbour link(s).');
}
write('lib/generated/municipality-pages.json',pages);
