"""Cache official dated footprints for a bounded Progreso group, two workers."""
from pathlib import Path
import argparse,concurrent.futures,functools,hashlib,json,socket,urllib.parse,urllib.request
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/progreso-year-review-20261105';parser=argparse.ArgumentParser();parser.add_argument('--group',default='latest');args=parser.parse_args()
socket.getaddrinfo=functools.lru_cache(maxsize=64)(socket.getaddrinfo)
rows=json.loads((QA/f'{args.group}-proposals.json').read_text(encoding='utf-8'))['rows'];catalogue={i['releaseNum']:i for i in json.loads((ROOT/'public/data/history/esri-local-captures.json').read_text(encoding='utf-8'))['items']}
def fetch(release):
    selected=[r for r in rows if r['release']==release];points=[r['p'] for r in selected];bounds=[min(p[0] for p in points)-.003,min(p[1] for p in points)-.003,max(p[0] for p in points)+.003,max(p[1] for p in points)+.003]
    params={'f':'json','where':'1=1','outFields':'SRC_DATE2,NICE_DESC,SRC_DESC,SAMP_RES,SRC_ACC','geometry':','.join(map(str,bounds)),'geometryType':'esriGeometryEnvelope','inSR':'4326','outSR':'4326','returnGeometry':'true','spatialRel':'esriSpatialRelIntersects'}
    url=catalogue[release]['metadataLayerUrl']+'/6/query?'+urllib.parse.urlencode(params);key=hashlib.sha256(url.encode()).hexdigest()[:16];dest=QA/f'metadata-footprints/{args.group}-{release}-{key}.json'
    try:
        if dest.exists():data=dest.read_bytes()
        else:
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(url,timeout=30) as response:data=response.read()
                    result=json.loads(data);assert 'features' in result and not result.get('exceededTransferLimit');break
                except Exception:
                    if attempt==2:raise
            dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
        result=json.loads(data);assert result.get('spatialReference',{}).get('wkid')==4326,result.get('spatialReference');assert not result.get('exceededTransferLimit');assert result['features'] and all(f.get('geometry',{}).get('rings') for f in result['features'])
        return {'release':release,'status':'valid_official_footprint_geometry','bounds':bounds,'url':url,'cache':str(dest.relative_to(ROOT)),'sha256':hashlib.sha256(data).hexdigest(),'feature_count':len(result['features'])}
    except Exception as e:return {'release':release,'status':'pending_footprint_query','url':url,'detail':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:manifest=list(pool.map(fetch,sorted({r['release'] for r in rows})))
(QA/f'{args.group}-footprints.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(manifest,ensure_ascii=False),flush=True)
