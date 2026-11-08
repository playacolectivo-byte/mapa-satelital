"""Locate the user's annotated 2011 screenshots on the unchanged source grid.

Registration measures the screenshot camera transform; it never warps the
geographic source, interprets a different shoreline, or changes map data.
"""
from pathlib import Path
import concurrent.futures, hashlib, io, json, math, urllib.request
import numpy as np
from PIL import Image
import cv2

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/shoreline-user-guides-20261105';OUT.mkdir(parents=True,exist_ok=True)
FILES=['1906c438-033a-4835-9833-d9c03cdf9de0','e860ae6a-d4e7-4731-be2d-dc0faf985a99','9a6f0ae5-5a69-4cc5-acbc-927bbff5fc00','fa7fdafd-a56d-4ead-97c6-5f91faaa3d2d','ec710af1-de64-4a09-a4b6-ee88a71212b1','ef37e230-c5ac-45ef-9601-9d38c739a55a']
model=json.loads((ROOT/'public/data/shorelines/scenario/model.json').read_text(encoding='utf-8'))
targets=sorted([t for t in model['targets'] if t['m']=='Progreso' and t['type'].startswith('Playa') and -89.87<t['p'][0]<-89.8],key=lambda t:t['p'][0])
Z=17;SIZE=256*2**Z
def pixel(p):return np.array([(p[0]+180)/360*SIZE,(1-math.asinh(math.tan(math.radians(p[1])))/math.pi)/2*SIZE])
points=np.array([pixel(t['p']) for t in targets]);lo=np.floor((points.min(0)-250)/256).astype(int);hi=np.floor((points.max(0)+250)/256).astype(int)
origin=lo*256
def tile(task):
 x,y=task;name=f'{Z}-{x}-{y}.jpg';dest=OUT/'tiles'/name
 caches=[ROOT/f'work/{folder}/tiles/11019/{name}' for folder in ['shoreline-review-20261105','shoreline-reference-refinement-20261105']]
 if dest.exists():data=dest.read_bytes()
 elif any(p.exists() for p in caches):data=next(p for p in caches if p.exists()).read_bytes()
 else:
  url=f'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/11019/{Z}/{y}/{x}'
  for attempt in range(3):
   try:
    with urllib.request.urlopen(url,timeout=30) as r:data=r.read()
    break
   except Exception:
    if attempt==2:raise
 dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
 return x,y,Image.open(io.BytesIO(data)).convert('RGB'),hashlib.sha256(data).hexdigest()
mosaic=Image.new('RGB',tuple((hi-lo+1)*256));tiles=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 for x,y,im,sha in pool.map(tile,[(x,y) for y in range(lo[1],hi[1]+1) for x in range(lo[0],hi[0]+1)]):
  mosaic.paste(im,((x-lo[0])*256,(y-lo[1])*256));tiles.append({'x':x,'y':y,'sha256':sha})
mosaic.save(OUT/'source-2011.png');print('Source mosaic ready',mosaic.size,flush=True)
sift=cv2.SIFT_create(nfeatures=35000)
grey=cv2.cvtColor(np.asarray(mosaic),cv2.COLOR_RGB2GRAY);mk,md=sift.detectAndCompute(grey,None)
records=[]
for n,name in enumerate(FILES,1):
 src=Path('C:/Users/papus/AppData/Local/Temp')/f'codex-clipboard-{name}.png';data=src.read_bytes();(OUT/f'guide-{n:02}.png').write_bytes(data)
 im=cv2.imdecode(np.frombuffer(data,np.uint8),cv2.IMREAD_COLOR);g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY)
 mask=np.ones(g.shape,np.uint8)*255;mask[:150]=0;mask[-120:]=0
 sk,sd=sift.detectAndCompute(g,mask)
 matches=cv2.BFMatcher().knnMatch(sd,md,k=2);good=[a for a,b in matches if a.distance<.68*b.distance]
 a=np.float32([sk[x.queryIdx].pt for x in good]);b=np.float32([mk[x.trainIdx].pt for x in good])
 affine,inliers=cv2.estimateAffinePartial2D(a,b,method=cv2.RANSAC,ransacReprojThreshold=1.5,maxIters=10000,confidence=.999)
 if affine is None:raise RuntimeError(f'Unregistered guide {n}')
 selected=inliers.ravel().astype(bool);error=np.linalg.norm((a@affine[:,:2].T+affine[:,2])-b,axis=1)[selected]
 assert selected.sum()>=25 and np.median(error)<.7
 # The map is north-up. Reject rotation/shear rather than moving the source.
 assert abs(affine[0,1])<.002 and abs(affine[1,0])<.002
 record={'guide':n,'file':str(src),'sha256':hashlib.sha256(data).hexdigest(),'affine_screen_to_mosaic':affine.tolist(),'inliers':int(selected.sum()),'median_error_native_px':float(np.median(error)),'p95_error_native_px':float(np.quantile(error,.95)),'size':[im.shape[1],im.shape[0]]}
 records.append(record);print(json.dumps(record),flush=True)
(OUT/'registration.json').write_text(json.dumps({'zoom':Z,'origin_pixel':origin.tolist(),'tiles':tiles,'profiles':targets,'guides':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
