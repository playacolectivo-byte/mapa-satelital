"""Verify source/date at existing endpoints, without approving their interpretation."""
from pathlib import Path
import argparse,concurrent.futures,datetime,hashlib,json,math,socket,urllib.parse,urllib.request
parser=argparse.ArgumentParser();parser.add_argument('--releases',type=int,nargs='+',default=[27946,18820,15045,20753,10321,64776,25285,22252]);parser.add_argument('--metadata-ip');parser.add_argument('--baseline-only',action='store_true');args=parser.parse_args()
if args.metadata_ip:
 socket.inet_pton(socket.AF_INET,args.metadata_ip);original_getaddrinfo=socket.getaddrinfo
 def cached_getaddrinfo(host,port,*extra,**kwargs):return original_getaddrinfo(args.metadata_ip if host=='metadata.maptiles.arcgis.com' else host,port,*extra,**kwargs)
 socket.getaddrinfo=cached_getaddrinfo
root=Path(__file__).resolve().parents[1];qa=root/'work/hunucma-audit-20261105'
model=json.loads((root/'public/data/municipalities/hunucma/scenario.json').read_text(encoding='utf-8'));modelrows={t['id']:t for t in model['targets'] if t['type'].startswith('Playa')}
photosraw=(root/'public/data/municipalities/hunucma/photos.json').read_bytes();photos=json.loads(photosraw);items=json.loads((root/'public/data/history/esri-local-captures.json').read_text(encoding='utf-8'))['items'];items={i['releaseNum']:i for i in items}
baseline_ids={t['id'] for t in json.loads((qa/'release-11019/manifest.json').read_text(encoding='utf-8'))['profiles']}
tasks=[]
for target in photos['targets']:
 if target['id'] not in modelrows or (args.baseline_only and target['id'] not in baseline_ids):continue
 for reading in target['readings']:
  if not reading['accepted'] or reading['offset_m'] is None:continue
  for release in reading['releases']:
   if release in args.releases:tasks.append((modelrows[target['id']],reading,release))
def verify(task):
 target,reading,release=task;capture=photos['captures'][reading['capture']];offset=reading['offset_m'];lon,lat=target['p'];r=6378137;s=math.cos(math.radians(lat));x=r*math.radians(lon)+target['v'][0]*offset/s;y=r*math.asinh(math.tan(math.radians(lat)))+target['v'][1]*offset/s;coordinate=[math.degrees(x/r),math.degrees(math.atan(math.sinh(y/r)))]
 params={'f':'json','where':'1=1','outFields':'SRC_DATE2,NICE_DESC,SRC_DESC,SAMP_RES,SRC_ACC','geometry':json.dumps({'spatialReference':{'wkid':4326},'x':coordinate[0],'y':coordinate[1]}),'geometryType':'esriGeometryPoint','returnGeometry':'false','spatialRel':'esriSpatialRelIntersects'}
 url=items[release]['metadataLayerUrl']+'/6/query?'+urllib.parse.urlencode(params);key=hashlib.sha256(url.encode()).hexdigest();dest=qa/f'later-endpoint-metadata/{release}-{target["id"]}-{key[:16]}.json';record={'profile_id':target['id'],'capture':reading['capture'],'release':release,'date':capture['date'],'source':capture['source'],'offset_m':offset,'coordinate':coordinate,'url':url,'visual_interpretation_verified':False}
 try:
  if dest.exists():data=dest.read_bytes()
  else:
   for attempt in range(3):
    try:
     with urllib.request.urlopen(url,timeout=20) as response:data=response.read()
     break
    except Exception:
     if attempt==2:raise
   dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
  result=json.loads(data);assert len(result.get('features',[]))==1,result
  attrs=result['features'][0]['attributes'];actual=datetime.datetime.fromtimestamp(attrs['SRC_DATE2']/1000,datetime.timezone.utc).date().isoformat();record.update(actual_date=actual,actual_source=attrs['SRC_DESC'],metadata_sha256=hashlib.sha256(data).hexdigest(),metadata_file=str(dest.relative_to(root)),status='verified' if actual==capture['date'] and attrs['SRC_DESC']==capture['source'] else 'mismatch')
 except Exception as error:record.update(status='unverified',detail=str(error))
 return record
print(f'Checking {len(tasks)} existing accepted endpoints; at most two simultaneous queries. This does not approve their visible-edge interpretation.',flush=True)
records=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for n,record in enumerate(pool.map(verify,tasks),1):
  records.append(record)
  if n%25==0:print(f'{n}/{len(tasks)} endpoints checked',flush=True)
report={'photos_sha256':hashlib.sha256(photosraw).hexdigest(),'releases':args.releases,'baseline_only':args.baseline_only,'note':'Source/date verification only; no interpretation acceptance or scientific data mutations.','records':records}
dest=root/f'docs/qa/hunucma-source-endpoints-{ "baseline" if args.baseline_only else "all" }-20261105.json';dest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(str(dest),flush=True)
