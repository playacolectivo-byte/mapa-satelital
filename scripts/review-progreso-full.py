"""Fetch native dated corridors for the full Progreso review, with a byte cache."""
from pathlib import Path
import argparse,concurrent.futures,functools,hashlib,io,json,math,socket,urllib.request
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'work/progreso-full-review-20261105';OUT.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('--baseline',action='store_true');args=parser.parse_args()
original_getaddrinfo=socket.getaddrinfo
socket.getaddrinfo=functools.lru_cache(maxsize=64)(original_getaddrinfo)
model=json.loads((ROOT/'public/data/municipalities/progreso/scenario.json').read_text(encoding='utf-8'));photos=json.loads((ROOT/'public/data/municipalities/progreso/photos.json').read_text(encoding='utf-8'));lookup={t['id']:t for t in photos['targets']}
Z=17;SIZE=256*2**Z
def pixel(p):return np.array([(p[0]+180)/360*SIZE,(1-math.asinh(math.tan(math.radians(p[1])))/math.pi)/2*SIZE])
records=[];tiles=set()
for t in model['targets']:
 if not t['type'].startswith('Playa'):continue
 seen=set()
 for r in sorted(lookup[t['id']]['readings'],key=lambda r:(not r['accepted'],photos['captures'][r['capture']]['resolution_m'])):
  c=photos['captures'][r['capture']]
  if args.baseline and r['capture']!=40:continue
  if not 2011<=int(c['date'][:4])<=2025 or c['date'] in seen:continue
  seen.add(c['date']);release=11019 if args.baseline else r['releases'][0]
  p=pixel(t['p']);mpp=156543.03392804097*math.cos(math.radians(t['p'][1]))/2**Z;v=np.array([t['v'][0],-t['v'][1]]);u=np.array([t['v'][1],t['v'][0]])
  corners=np.array([p+v*a/mpp+u*b/mpp for a in [-150,150] for b in [-18,18]]);lo=np.floor(corners.min(0)/256).astype(int);hi=np.floor(corners.max(0)/256).astype(int)
  for y in range(lo[1],hi[1]+1):
   for x in range(lo[0],hi[0]+1):tiles.add((release,x,y))
  records.append({'profile_id':t['id'],'capture':r['capture'],'date':c['date'],'release':release,'source':c,'previous':r,'p':t['p'],'v':t['v'],'pixel':p.tolist(),'mpp':mpp,'tile_lo':lo.tolist(),'tile_hi':hi.tolist()})
print('Profiles/reads/tiles',len({r['profile_id'] for r in records}),len(records),len(tiles),flush=True)
def fetch(task):
 release,x,y=task;name=f'{Z}-{x}-{y}.jpg';dest=OUT/f'tiles/{release}/{name}'
 caches=[ROOT/f'work/{folder}/tiles/{release}/{name}' for folder in ['shoreline-review-20261105','shoreline-reference-refinement-20261105']]
 if release==11019:caches.append(ROOT/f'work/shoreline-user-guides-20261105/tiles/{name}')
 if dest.exists():data=dest.read_bytes()
 elif any(p.exists() for p in caches):data=next(p for p in caches if p.exists()).read_bytes()
 else:
  url=f'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/{release}/{Z}/{y}/{x}'
  for attempt in range(3):
   try:
    with urllib.request.urlopen(url,timeout=30) as response:data=response.read()
    Image.open(io.BytesIO(data)).verify();break
   except Exception:
    if attempt==2:return {'release':release,'x':x,'y':y,'error':'source_unavailable'}
 dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
 return {'release':release,'x':x,'y':y,'sha256':hashlib.sha256(data).hexdigest()}
manifest=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for i,result in enumerate(pool.map(fetch,sorted(tiles))):
  manifest.append(result)
  if i%100==0:print('Cached tiles',i+1,'/',len(tiles),flush=True)
@functools.lru_cache(maxsize=128)
def tile(release,x,y):return Image.open(OUT/f'tiles/{release}/{Z}-{x}-{y}.jpg').convert('RGB')
missing={(r['release'],r['x'],r['y']) for r in manifest if r.get('error')}
failed=[r for r in records if any((r['release'],x,y) in missing for y in range(r['tile_lo'][1],r['tile_hi'][1]+1) for x in range(r['tile_lo'][0],r['tile_hi'][0]+1))]
records=[r for r in records if r not in failed]
(OUT/'source-failures.json').write_text(json.dumps(failed,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
across=np.arange(150,-150.01,-.5);along=np.linspace(-15,15,31)
samples=np.empty((len(records),len(across),len(along),3),dtype=np.uint8)
for i,r in enumerate(records):
 lo=np.array(r['tile_lo']);hi=np.array(r['tile_hi']);im=Image.new('RGB',tuple((hi-lo+1)*256))
 for y in range(lo[1],hi[1]+1):
  for x in range(lo[0],hi[0]+1):im.paste(tile(r['release'],x,y),((x-lo[0])*256,(y-lo[1])*256))
 array=np.asarray(im);v=np.array([r['v'][0],-r['v'][1]]);u=np.array([r['v'][1],r['v'][0]]);p=np.array(r['pixel'])
 xy=p[:,None,None]+v[:,None,None]*across[None,:,None]/r['mpp']+u[:,None,None]*along[None,None,:]/r['mpp']-(lo*256)[:,None,None]
 samples[i]=np.stack([map_coordinates(array[:,:,c],[xy[1],xy[0]],order=1,mode='nearest') for c in range(3)],axis=-1).astype('uint8')
tag='baseline' if args.baseline else 'all-dates'
np.savez_compressed(OUT/f'{tag}-samples.npz',samples=samples,offsets=across,along=along)
(OUT/f'{tag}-inventory.json').write_text(json.dumps({'zoom':Z,'records':records,'tiles':manifest},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Complete',tag,len(records),flush=True)
