"""Bounded native imagery panels for Hunucma; no scientific asset mutations."""
from pathlib import Path
import argparse,concurrent.futures,hashlib,io,json,math,socket,urllib.request
import numpy as np
from PIL import Image,ImageDraw
from scipy.ndimage import map_coordinates
import rasterio
from rasterio.transform import from_origin
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--release',type=int,default=11019);parser.add_argument('--date',default='2011-08-01');parser.add_argument('--all-profiles',action='store_true');parser.add_argument('--baseline-only',action='store_true');parser.add_argument('--workers',type=int,choices=[1,2,3,4],default=4);parser.add_argument('--tile-ip');parser.add_argument('--output',type=Path);args=parser.parse_args()
if args.tile_ip:
 socket.inet_pton(socket.AF_INET,args.tile_ip)
 original_getaddrinfo=socket.getaddrinfo
 def cached_getaddrinfo(host,port,*extra,**kwargs):
  return original_getaddrinfo(args.tile_ip if host=='wayback.maptiles.arcgis.com' else host,port,*extra,**kwargs)
 socket.getaddrinfo=cached_getaddrinfo
QA=ROOT/'work/hunucma-audit-20261105';OUT=args.output or QA/f'release-{args.release}';OUT.mkdir(parents=True,exist_ok=True)
baseline_ids={t['id'] for t in json.loads((QA/'release-11019/manifest.json').read_text(encoding='utf-8'))['profiles']} if args.baseline_only else None
model=json.loads((ROOT/'public/data/municipalities/hunucma/scenario.json').read_text(encoding='utf-8'));photos=json.loads((ROOT/'public/data/municipalities/hunucma/photos.json').read_text(encoding='utf-8'));rows={t['id']:t for t in photos['targets']}
targets=[]
for t in model['targets']:
 if not t['type'].startswith('Playa'):continue
 if baseline_ids is not None and t['id'] not in baseline_ids:continue
 reading=next((r for r in rows[t['id']]['readings'] if args.release in r['releases']),None)
 if reading and (args.all_profiles or photos['captures'][reading['capture']]['date']==args.date):targets.append(t)
targets.sort(key=lambda t:t['p'][0])
Z=17;SIZE=256*2**Z
def pixel(p):return np.array([(p[0]+180)/360*SIZE,(1-math.asinh(math.tan(math.radians(p[1])))/math.pi)/2*SIZE])
tiles=set()
for t in targets:
 scale=156543.03392804097*math.cos(math.radians(t['p'][1]))/2**Z;normal=np.array([t['v'][0],-t['v'][1]]);tangent=np.array([normal[1],-normal[0]])
 corners=np.array([pixel(t['p'])+normal*d/scale+tangent*a/scale for d in [-150,150] for a in [-25,25]])
 lo=np.floor(corners.min(0)/256).astype(int);hi=np.floor(corners.max(0)/256).astype(int)
 tiles.update((x,y) for y in range(lo[1],hi[1]+1) for x in range(lo[0],hi[0]+1))
tile_lo=np.min(np.array(list(tiles)),axis=0);tile_hi=np.max(np.array(list(tiles)),axis=0);origin=tile_lo*256
mosaic=Image.new('RGB',tuple((tile_hi-tile_lo+1)*256))
def download(task):
 x,y=task;name=f'{Z}-{x}-{y}.jpg';dest=OUT/'tiles'/name
 caches=[ROOT/f'work/{folder}/tiles/{args.release}/{name}' for folder in ['shoreline-review-20261105','shoreline-reference-refinement-20261105']]
 caches.append(ROOT/f'work/hunucma-additional-review-20261106/release-{args.release}/tiles/{name}')
 if args.release==11019:caches.append(ROOT/f'work/shoreline-user-guides-20261105/tiles/{name}')
 if dest.exists():data=dest.read_bytes()
 elif any(p.exists() for p in caches):data=next(p for p in caches if p.exists()).read_bytes()
 else:
  url=f'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/{args.release}/{Z}/{y}/{x}'
  for attempt in range(3):
   try:
    with urllib.request.urlopen(url,timeout=30) as response:data=response.read()
    break
   except Exception:
    if attempt==2:raise
 dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data);im=Image.open(io.BytesIO(data)).convert('RGB');assert im.size==(256,256)
 return x,y,im,{'x':x,'y':y,'sha256':hashlib.sha256(data).hexdigest(),'url':f'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/{args.release}/{Z}/{y}/{x}'}
manifest={'release':args.release,'zoom':Z,'origin_pixel':origin.tolist(),'profiles':targets,'tiles':[],'sampling':'Panel offset zero at y=340; positive sea at top; .5m/display pixel, not native resolution.'}
print(f'Retrieving {len(tiles)} native tiles for {len(targets)} profiles.',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
 for x,y,im,record in pool.map(download,sorted(tiles)):
  mosaic.paste(im,((x-tile_lo[0])*256,(y-tile_lo[1])*256));manifest['tiles'].append(record)
mosaic.save(OUT/'mosaic.png');array=np.asarray(mosaic)
world_pixel=2*math.pi*6378137/SIZE;transform=from_origin(-math.pi*6378137+origin[0]*world_pixel,math.pi*6378137-origin[1]*world_pixel,world_pixel,world_pixel)
with rasterio.open(OUT/'source.tif','w',driver='GTiff',width=mosaic.width,height=mosaic.height,count=3,dtype='uint8',crs='EPSG:3857',transform=transform,compress='deflate',tiled=True,nodata=0) as dst:
 dst.write(np.moveaxis(array,-1,0));dst.update_tags(attribution='Esri World Imagery Wayback; original source identity in photo catalogue',release=args.release)
for start in range(0,len(targets),14):
 group=targets[start:start+14];panel=Image.new('RGB',(len(group)*80,680),'#172b30');draw=ImageDraw.Draw(panel)
 for i,t in enumerate(group):
  scale=156543.03392804097*math.cos(math.radians(t['p'][1]))/2**Z;normal=np.array([t['v'][0],-t['v'][1]]);tangent=np.array([t['v'][1],t['v'][0]])
  across=150-np.arange(601)*.5;along=(np.arange(80)-39.5)*.5
  xy=pixel(t['p'])[:,None,None]+normal[:,None,None]*across[None,:,None]/scale+tangent[:,None,None]*along[None,None,:]/scale-origin[:,None,None]
  rgb=np.stack([map_coordinates(array[:,:,c],[xy[1],xy[0]],order=1,mode='constant') for c in range(3)],axis=-1).astype('uint8');panel.paste(Image.fromarray(rgb),(i*80,40))
  draw.text((i*80+4,4),f'{start+i}: '+t['id'].replace('SC-',''),fill='white')
  reading=next(r for r in rows[t['id']]['readings'] if args.release in r['releases']);date=photos['captures'][reading['capture']]['date'];draw.text((i*80+4,20),date,fill='white')
  draw.line((i*80+39,40,i*80+39,640),fill='#f2d24e')
  for offset in [-100,-50,0,50,100]:
   y=340-offset*2;draw.line((i*80,y,i*80+79,y),fill='#667c80',width=1)
  draw.line((i*80,340,i*80+79,340),fill='#db32bf')
 draw.text((5,650),f'Edition {args.release}; y=340 at zero; .5m per display pixel; top +150m sea; native tiles z17. No shoreline assertion.',fill='white')
 panel.save(OUT/f'profiles-{start:03}.png')
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'targets':len(targets),'tiles':len(tiles),'mosaic':mosaic.size,'output':str(OUT)}),flush=True)
