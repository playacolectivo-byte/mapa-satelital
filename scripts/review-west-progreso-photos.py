"""Retrieve a bounded, attributed local QA sample; never alter source readings."""
from pathlib import Path
import argparse, concurrent.futures, datetime, hashlib, io, json, math, urllib.parse, urllib.request
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import map_coordinates

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--count',type=int,default=20)
parser.add_argument('--output',default='work/shoreline-review-20261105')
args=parser.parse_args()
OUT=ROOT/args.output
CACHE=ROOT/'work/shoreline-review-20261105'
OUT.mkdir(parents=True,exist_ok=True)
MODEL=json.loads((ROOT/'public/data/municipalities/progreso/scenario.json').read_text())
PHOTOS=json.loads((ROOT/'public/data/municipalities/progreso/photos.json').read_text())
TARGETS=sorted([t for t in MODEL['targets'] if t['type'].startswith('Playa')],key=lambda t:t['p'][0])[:args.count]
ITEMS=json.loads((ROOT/'public/data/history/esri-local-captures.json').read_text())['items']
RELEASES=[11019,27946,18820,20753,17825,25285,22252]
Z=17; SIZE=256*2**Z
def pixel(p):
    lon,lat=p
    return np.array([(lon+180)/360*SIZE,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*SIZE])
points=np.array([pixel(t['p']) for t in TARGETS])
lo=np.floor((points.min(axis=0)-150)/256).astype(int)
hi=np.floor((points.max(axis=0)+150)/256).astype(int)
def fetch(url,dest):
    if dest.exists(): return dest.read_bytes()
    cached=CACHE/dest.relative_to(OUT)
    if cached.exists():
        data=cached.read_bytes();dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data);return data
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'ColectivoPlaya-local-shoreline-review/1.0'}),timeout=30) as response: data=response.read()
            dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data);return data
        except Exception:
            if attempt==2: raise
def tile(task):
    release,x,y=task
    url=f'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/{release}/{Z}/{y}/{x}'
    dest=OUT/f'tiles/{release}/{Z}-{x}-{y}.jpg'
    data=fetch(url,dest)
    img=Image.open(io.BytesIO(data)).convert('RGB')
    assert img.size==(256,256)
    return release,x,y,img,{'url':url,'sha256':hashlib.sha256(data).hexdigest(),'file':str(dest.relative_to(OUT))}
tasks=[(r,x,y) for r in RELEASES for y in range(lo[1],hi[1]+1) for x in range(lo[0],hi[0]+1)]
mosaics={r:Image.new('RGB',((hi[0]-lo[0]+1)*256,(hi[1]-lo[1]+1)*256)) for r in RELEASES}
manifest={'date':'2026-11-05','provider':'Esri World Imagery Wayback; source attribution in point metadata','zoom':Z,'origin_pixel':(lo*256).tolist(),'profiles':TARGETS,'tiles':[],'metadata':[]}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    for release,x,y,img,entry in pool.map(tile,tasks):
        mosaics[release].paste(img,((x-lo[0])*256,(y-lo[1])*256));manifest['tiles'].append(entry)
print(f'Retrieved {len(tasks)} tiles for {len(TARGETS)} profiles',flush=True)
def metadata(task):
    release,t=task
    item=next(i for i in ITEMS if i['releaseNum']==release)
    params={'f':'json','where':'1=1','outFields':'SRC_DATE2,NICE_DESC,SRC_DESC,SAMP_RES,SRC_ACC','geometry':json.dumps({'spatialReference':{'wkid':4326},'x':t['p'][0],'y':t['p'][1]}),'geometryType':'esriGeometryPoint','returnGeometry':'false','spatialRel':'esriSpatialRelIntersects'}
    url=item['metadataLayerUrl']+f'/{23-Z}/query?'+urllib.parse.urlencode(params)
    data=fetch(url,OUT/f'metadata/{release}-{t["id"]}.json')
    parsed=json.loads(data)
    if 'error' in parsed:raise RuntimeError(parsed['error'])
    attributes=[f['attributes'] for f in parsed.get('features',[])]
    for a in attributes:
        if isinstance(a.get('SRC_DATE2'),(int,float)):a['capture_date']=datetime.datetime.fromtimestamp(a['SRC_DATE2']/1000,datetime.timezone.utc).date().isoformat()
    return {'profile_id':t['id'],'release':release,'zoom':Z,'url':url,'sha256':hashlib.sha256(data).hexdigest(),'attributes':attributes}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:manifest['metadata']=list(pool.map(metadata,[(r,t) for r in RELEASES for t in TARGETS]))
for release,mosaic in mosaics.items():
    mosaic.save(OUT/f'mosaic-{release}.png')
    array=np.asarray(mosaic)
    curtain=Image.new('RGB',(len(TARGETS)*72,470),'#172b30');draw=ImageDraw.Draw(curtain)
    draw.text((8,5),f'Esri Wayback edition {release}, z{Z}; +100 m sea (top) to -100 m land (bottom); 0.5 m / display pixel',fill='white')
    for i,t in enumerate(TARGETS):
        scale=156543.03392804097*math.cos(math.radians(t['p'][1]))/2**Z
        normal=np.array([t['v'][0],-t['v'][1]])
        tangent=np.array([t['v'][1],t['v'][0]])
        across=100-np.arange(401)*.5
        along=(np.arange(72)-35.5)*.5
        xy=pixel(t['p'])[:,None,None]+normal[:,None,None]*across[None,:,None]/scale+tangent[:,None,None]*along[None,None,:]/scale-(lo*256)[:,None,None]
        rgb=np.stack([map_coordinates(array[:,:,c],[xy[1],xy[0]],order=1,mode='nearest') for c in range(3)],axis=-1).astype('uint8')
        curtain.paste(Image.fromarray(rgb),(i*72,40))
        draw.text((i*72+3,23),str(t['id'].split('-')[-1]),fill='white')
        draw.line([(i*72+35,40),(i*72+35,440)],fill=(255,210,0),width=1)
        draw.line([(i*72,240),(i*72+71,240)],fill=(255,0,255),width=1)
        draw.line([(i*72,40),(i*72,440)],fill='#172b30',width=1)
    draw.text((8,450),'Yellow: fixed sampling axis. Magenta: received nominal cartography (offset 0). Not a shoreline trace.',fill='white')
    curtain.save(OUT/f'profiles-{release}.png')
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'profiles':[t['id'] for t in TARGETS],'tile_count':len(tasks),'output':str(OUT),'metadata_count':len(manifest['metadata'])}),flush=True)
