"""Package the frozen map for Pages dashboard's 1,000-file upload limit.

Original URL paths and decoded bytes remain unchanged. Only crowded data
trees use an indexed, cacheable asset reader. No database or secret required.
"""
import argparse, gzip, hashlib, json, mimetypes, re, zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MAX_PACK=4*1024*1024

WORKER='''
const INDEX=__INDEX__;
function headersFor(row) {
  const hashPath=/\\/[a-f0-9]{64}\\./.test(row[7]);
  const h=new Headers({'Content-Type':row[4],'ETag':'"'+row[6]+'"','Cache-Control':hashPath?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate','X-Content-Type-Options':'nosniff'});
  if(row[5])h.set('Content-Encoding','gzip');
  return h;
}
// Small bounded isolate cache coalesces concurrent readers of the same pack.
const PACKS=new Map(),PENDING=new Map(),WAITERS=[];let active=0;
async function acquire(){if(active<2){active++;return;}await new Promise(resolve=>WAITERS.push(resolve));}
function release(){const next=WAITERS.shift();if(next)next();else active--;}
async function entryBody(env,url,row){
  let bytes=PACKS.get(row[0]);
  if(bytes){PACKS.delete(row[0]);PACKS.set(row[0],bytes);}
  else {
    let pending=PENDING.get(row[0]);
    if(!pending){pending=(async()=>{
      await acquire();try{
        const response=await env.ASSETS.fetch(new Request(new URL('/_packs/'+row[0]+'.bin',url)));
        if(!response.ok)throw new Error('Packed asset unavailable');
        const buffer=new Uint8Array(await response.arrayBuffer());
        PACKS.set(row[0],buffer);while(PACKS.size>4)PACKS.delete(PACKS.keys().next().value);
        return buffer;
      }finally{release();PENDING.delete(row[0]);}
    })();PENDING.set(row[0],pending);}
    bytes=await pending;
  }
  if(row[1]+row[2]>bytes.length)throw new Error('Incomplete packed asset');
  return bytes.slice(row[1],row[1]+row[2]);
}
export default {async fetch(request,env,ctx) {
  const url=new URL(request.url);let path;try{path=decodeURIComponent(url.pathname);}catch{return new Response('Not found',{status:404});}
  const row=INDEX[path];
  if(!row)return env.ASSETS.fetch(request);
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
  const headers=headersFor(row);
  if(request.headers.get('If-None-Match')===headers.get('ETag'))return new Response(null,{status:304,headers});
  if(request.method==='HEAD')return new Response(null,{headers});
  const cacheUrl=new URL(request.url);cacheUrl.search='?packed_sha='+row[6]+'&reader=4';
  const key=new Request(cacheUrl.toString());const cache=caches.default;
  const hit=await cache.match(key);
  if(hit)return new Response(hit.body,{headers,encodeBody:'manual'});
  let body;try{body=await entryBody(env,request.url,row);}catch{return new Response('Asset temporarily unavailable',{status:502,headers:{'Cache-Control':'no-store'}});}
  const ch=new Headers(headers);ch.set('Cache-Control','public, max-age=86400');
  ctx.waitUntil(cache.put(key,new Response(body,{headers:ch,encodeBody:'manual'})).catch(()=>{}));
  return new Response(body,{headers,encodeBody:'manual'});
}};
'''

def selected(name):
    return name.startswith(('data/shorelines/map/','data/shorelines/series-2015/','data/municipalities/','data/shorelines/annual/')) or re.match(r'data/history/\d+/',name)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('output');parser.add_argument('--source',default='dist/cloudflare-map');parser.add_argument('--report',required=True);parser.add_argument('--date',default='2026-11-02');args=parser.parse_args()
    source=(ROOT/args.source).resolve();output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    paths=sorted(p for p in source.rglob('*') if p.is_file());index={};files=[];packs=[];pending=bytearray();number=0
    def record(name,data):files.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as archive:
        def flush():
            nonlocal pending,number
            if not pending:return
            data=bytes(pending);name=f'_packs/{number:03}.bin';archive.writestr(name,data);record(name,data);packs.append({'path':name,'bytes':len(data)});pending=bytearray();number+=1
        for path in paths:
            name=path.relative_to(source).as_posix()
            if not selected(name):archive.write(path,name);record(name,path.read_bytes());continue
            data=path.read_bytes();sha=hashlib.sha256(data).hexdigest()
            encoded=gzip.compress(data,compresslevel=6,mtime=0) if path.suffix in {'.json','.geojson','.csv','.md','.txt'} else data
            compressed=len(encoded)<len(data)
            if not compressed:encoded=data
            if pending and len(pending)+len(encoded)>MAX_PACK:flush()
            if len(encoded)>MAX_PACK:raise ValueError('Packed entry exceeds budget: '+name)
            mime={'.geojson':'application/geo+json','.json':'application/json','.gz':'application/gzip','.md':'text/markdown','.csv':'text/csv'}.get(path.suffix,mimetypes.guess_type(name)[0] or 'application/octet-stream')
            index['/'+name]=[f'{number:03}',len(pending),len(encoded),len(data),mime,compressed,sha,'/'+name]
            pending.extend(encoded)
        flush()
        worker=WORKER.replace('__INDEX__',json.dumps(index,separators=(',',':'))).encode()
        routes={'version':1,'include':['/data/shorelines/map/*','/data/shorelines/series-2015/*','/data/municipalities/*','/data/shorelines/annual/*',*[f'/data/history/{x}/*' for x in sorted({n.split('/')[3] for n in index if re.match(r'/data/history/\d+/',n)})]],'exclude':[]}
        for name,data in [('_worker.js',worker),('_routes.json',json.dumps(routes,separators=(',',':')).encode())]:archive.writestr(name,data);record(name,data)
        manifest={'version':1,'date':args.date,'purpose':'Existing mapa-satelital.pages.dev dashboard deployment; exact decoded source bytes','original_files':len(paths),'packed_files':len(index),'deployed_files':len(files)+1,'worker_only_for_packed_trees':True,'maximum_pack_bytes':MAX_PACK,'assets':files}
        data=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode();archive.writestr('MANIFIESTO_ENTREGA.json',data);record('MANIFIESTO_ENTREGA.json',data)
    assert len(files)<=1000,(len(files),'dashboard file limit')
    assert max(r['bytes'] for r in files)<=25*1024*1024
    assert len(worker)<3*1024*1024
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        assert archive.getinfo('index.html').file_size>0
        for row in files:assert hashlib.sha256(archive.read(row['path'])).hexdigest()==row['sha256']
        cache={}
        for name,row in index.items():
            if row[0] not in cache:cache={row[0]:archive.read('_packs/'+row[0]+'.bin')}
            content=cache[row[0]][row[1]:row[1]+row[2]]
            if row[5]:content=gzip.decompress(content)
            assert len(content)==row[3] and hashlib.sha256(content).hexdigest()==row[6],name
    result={'status':'passed','archive':str(output),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'source_files':len(paths),'deployed_files':len(files),'packed_files':len(index),'packs':packs,'worker_bytes':len(worker),'decoded_content_hashes_verified':True,'index_at_root':True,'data_read_only':True,'backend':'Pages asset reader only for packed trees; regular assets remain static. Functions quotas apply to packed requests.'}
    Path(args.report).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False))

if __name__=='__main__':main()
