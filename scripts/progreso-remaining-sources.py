"""Fetch bounded official provenance footprints for remaining Progreso dates."""
from pathlib import Path
import concurrent.futures,hashlib,http.client,json,socket,urllib.parse
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'work/progreso-remaining-review-20261105';rows=json.loads((OUT/'remaining-proposals.json').read_text(encoding='utf-8'))['rows'];items={i['releaseNum']:i for i in json.loads((ROOT/'public/data/history/esri-local-captures.json').read_text(encoding='utf-8'))['items']};coords=[r['p']for r in rows];bounds=[min(p[0]for p in coords)-.003,min(p[1]for p in coords)-.003,max(p[0]for p in coords)+.003,max(p[1]for p in coords)+.003];lookup=socket.getaddrinfo;dns={}
def cached_lookup(host,port,*extra,**kw):
 key=(host,port,extra,tuple(sorted(kw.items())))
 if key not in dns:dns[key]=lookup(host,port,*extra,**kw)
 return dns[key]
socket.getaddrinfo=cached_lookup
def fetch(release):
 params={'f':'json','where':'1=1','outFields':'SRC_DATE2,NICE_DESC,SRC_DESC,SAMP_RES,SRC_ACC','geometry':','.join(map(str,bounds)),'geometryType':'esriGeometryEnvelope','inSR':'4326','outSR':'4326','returnGeometry':'true','spatialRel':'esriSpatialRelIntersects'};url=items[release]['metadataLayerUrl']+'/6/query?'+urllib.parse.urlencode(params);path=OUT/f'metadata-{release}-{hashlib.sha256(url.encode()).hexdigest()[:16]}.json'
 try:
  if path.exists():data=path.read_bytes()
  else:
   p=urllib.parse.urlsplit(url)
   for attempt in range(3):
    try:
     c=http.client.HTTPSConnection(p.netloc,timeout=20);c.request('GET',p.path+'?'+p.query,headers={'User-Agent':'ColectivoPlaya-Progreso-remaining-QA/1.0'});response=c.getresponse();data=response.read();c.close();assert response.status==200;result=json.loads(data);assert'features'in result;assert not result.get('exceededTransferLimit');path.write_bytes(data);break
    except Exception:
     if attempt==2:raise
  d=json.loads(data);return str(release),{'url':url,'path':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(data).hexdigest(),'features':len(d['features'])}
 except Exception as e:return str(release),{'url':url,'error':type(e).__name__+': '+str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:result=dict(pool.map(fetch,sorted({r['release']for r in rows})))
(OUT/'source-manifest.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result),flush=True)
