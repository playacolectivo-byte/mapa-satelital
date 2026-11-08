"""Independent, bounded image review for Dzemul; writes proposals, not app assets.

The detector proposes visible RGB boundaries with five parallel checks. Its
output must not be called surveyed or manually validated without inspection.
"""
from pathlib import Path
import argparse,concurrent.futures,hashlib,http.client,io,json,math,socket,threading,urllib.request,urllib.parse
import numpy as np
from PIL import Image,ImageDraw
from scipy.ndimage import map_coordinates,gaussian_filter1d
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'work/dzemul-audit-20261105';OUT.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('--process-cached',action='store_true');parser.add_argument('--reference-only',action='store_true');parser.add_argument('--workers',type=int,default=4);args=parser.parse_args()
MODEL=json.loads((ROOT/'public/data/municipalities/dzemul/scenario.json').read_text(encoding='utf-8'))
PHOTOS=json.loads((ROOT/'public/data/municipalities/dzemul/photos.json').read_text(encoding='utf-8'))
TARGETS=sorted(MODEL['targets'],key=lambda t:t['p'][0]);BY_ID={t['id']:t for t in TARGETS}
ROWS=[{'profile_id':t['id'],**r,'date':PHOTOS['captures'][r['capture']]['date']} for t in PHOTOS['targets'] for r in t['readings'] if 2011<=int(PHOTOS['captures'][r['capture']]['date'][:4])<=2025]
if args.reference_only:ROWS=[r for r in ROWS if r['date']=='2011-08-01']
PREFERRED=[22252,10321,15045,18820,27946,11019,64776,26334,25285]
# The local resolver intermittently fails between requests. Cache successful
# DNS responses within this process, retaining the original hostname for TLS
# verification; never change system DNS, hosts, certificates or validation.
_lookup=socket.getaddrinfo;_dns={}
def cached_lookup(host,port,*args,**kwargs):
 key=(host,port,args,tuple(sorted(kwargs.items())))
 if key in _dns:return _dns[key]
 result=_lookup(host,port,*args,**kwargs);_dns[key]=result;return result
socket.getaddrinfo=cached_lookup
_http=threading.local()
for row in ROWS:row['review_release']=next(r for r in PREFERRED if r in row['releases'])
Z=17;SIZE=256*2**Z
def pixel(p):return np.array([(p[0]+180)/360*SIZE,(1-math.asinh(math.tan(math.radians(p[1])))/math.pi)/2*SIZE])
def mpp(t):return 156543.03392804097*math.cos(math.radians(t['p'][1]))/2**Z
def extent(t):
 p=pixel(t['p']);n=np.array([t['v'][0],-t['v'][1]]);a=np.array([t['v'][1],t['v'][0]])
 corners=np.array([p+n*u/mpp(t)+a*v/mpp(t) for u in [-152,152] for v in [-22,22]])
 return np.floor(corners.min(0)/256).astype(int),np.floor(corners.max(0)/256).astype(int)
tasks=set()
for row in ROWS:
 lo,hi=extent(BY_ID[row['profile_id']]);tasks.update((row['review_release'],x,y) for y in range(lo[1],hi[1]+1) for x in range(lo[0],hi[0]+1))
def fetch(url,path):
 if path.exists():return path.read_bytes()
 for attempt in range(3):
  try:
   next_url=url;connections=getattr(_http,'connections',{});_http.connections=connections
   for redirect in range(5):
    parsed=urllib.parse.urlsplit(next_url)
    if parsed.scheme!='https' or not parsed.hostname.endswith('.arcgis.com'):raise RuntimeError('Unexpected source redirect host')
    connection=connections.get(parsed.netloc)
    if connection is None:connection=http.client.HTTPSConnection(parsed.netloc,timeout=15);connections[parsed.netloc]=connection
    connection.request('GET',parsed.path+('?' + parsed.query if parsed.query else ''),headers={'User-Agent':'ColectivoPlaya-dzemul-review/1.0','Connection':'keep-alive'})
    response=connection.getresponse();data=response.read()
    if response.status not in (301,302,303,307,308):break
    next_url=urllib.parse.urljoin(next_url,response.getheader('Location'))
   if response.status!=200:raise RuntimeError(f'HTTP {response.status}')
   path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data);return data
  except Exception:
   if 'connection' in locals():connection.close();connections.pop(parsed.netloc,None)
   if attempt==2:raise
def tile(task):
 r,x,y=task;url=f'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/{r}/{Z}/{y}/{x}';path=OUT/f'tiles/{r}/{Z}-{x}-{y}.jpg'
 try:
  if args.process_cached and not path.exists():return {'release':r,'x':x,'y':y,'error':'not_cached'}
  data=fetch(url,path)
 except Exception as e:return {'release':r,'x':x,'y':y,'error':type(e).__name__+': '+str(e)}
 im=Image.open(io.BytesIO(data));assert im.size==(256,256)
 return {'release':r,'x':x,'y':y,'url':url,'sha256':hashlib.sha256(data).hexdigest()}
print(json.dumps({'profiles':len(TARGETS),'dated_readings':len(ROWS),'tile_tasks':len(tasks)}),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=min(4,args.workers)) as pool:
 tiles=[]
 for item in pool.map(tile,sorted(tasks,key=lambda x:(x[0]!=11019,*x))):
  tiles.append(item)
  if len(tiles)%100==0:print('Retrieved/checked tiles',len(tiles),flush=True)
prefix='baseline-' if args.reference_only else ''
(OUT/(prefix+'input-manifest.json')).write_text(json.dumps({'zoom':Z,'profiles':TARGETS,'rows':ROWS,'tiles':tiles},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'retrieval_finished':True,'available_tiles':sum('error' not in t for t in tiles),'missing_tiles':sum('error' in t for t in tiles)}),flush=True)

def sample(row):
 t=BY_ID[row['profile_id']];lo,hi=extent(t);origin=lo*256
 im=Image.new('RGB',tuple((hi-lo+1)*256))
 for y in range(lo[1],hi[1]+1):
  for x in range(lo[0],hi[0]+1):im.paste(Image.open(OUT/f'tiles/{row["review_release"]}/{Z}-{x}-{y}.jpg').convert('RGB'),tuple((np.array([x,y])-lo)*256))
 array=np.asarray(im);p=pixel(t['p'])-origin;n=np.array([t['v'][0],-t['v'][1]]);a=np.array([t['v'][1],t['v'][0]])
 offsets=150-np.arange(601)*.5;along=(np.arange(64)-31.5)*.6
 xy=p[:,None,None]+n[:,None,None]*offsets[None,:,None]/mpp(t)+a[:,None,None]*along[None,None,:]/mpp(t)
 rgb=np.stack([map_coordinates(array[:,:,c],[xy[1],xy[0]],order=1,mode='nearest') for c in range(3)],-1).astype('uint8')
 return rgb

def propose(rgb):
 # Independent RGB-edge proposal: compare a seaward reference to the bright,
 # weakly vegetated band and require the same transition in parallel axes.
 estimates=[];strengths=[]
 for center in [11,21,32,42,52]:
  col=np.median(rgb[:,max(0,center-2):center+3,:].astype(float),axis=1);col=gaussian_filter1d(col,2,axis=0)
  sea=np.median(col[:100],axis=0)
  beachness=col[:,0]-.65*col[:,1]-.35*col[:,2]
  light=col.mean(1)
  vegetation=col[:,1]-col[:,0]
  # Find the strongest connected beach band inland of the open-water sample.
  band=gaussian_filter1d(beachness,4);allowed=(np.arange(len(col))>110)&(np.arange(len(col))<530)&(vegetation<12)&(light>np.mean(sea)+3)
  if not np.any(allowed):continue
  peak=int(np.argmax(np.where(allowed,band,-1e6)))
  land=col[max(0,peak-5):peak+6].mean(0);direction=land-sea
  if np.linalg.norm(direction)<15:continue
  score=(col-sea)@direction/max(float(direction@direction),1)
  gradient=gaussian_filter1d(score,2,order=1)
  search=np.arange(100,min(peak+1,540));candidates=[int(k) for k in search if score[k]>=.48 and np.median(score[k:min(k+14,len(score))])>.5]
  if not candidates:continue
  k=candidates[0];strength=float(np.linalg.norm(col[min(600,k+8)]-col[max(0,k-8)]))
  estimates.append(150-k*.5);strengths.append(strength)
 if len(estimates)<4:return {'accepted':False,'reason':'insufficient_parallel_support','candidates_m':estimates}
 spread=float(np.max(estimates)-np.min(estimates));offset=float(np.median(estimates));strength=float(np.median(strengths))
 accepted=spread<=10 and strength>=14 and abs(offset)<135
 return {'accepted':accepted,'reason':None if accepted else 'parallel_disagreement_or_weak_rgb_edge','offset_m':offset,'spread_m':spread,'rgb_contrast':strength,'candidates_m':estimates}

results=[];groups={}
for j,row in enumerate(ROWS):
 try:rgb=sample(row);proposal=propose(rgb)
 except FileNotFoundError:rgb=np.zeros((601,64,3),dtype='uint8');proposal={'accepted':False,'reason':'source_tiles_missing','candidates_m':[]}
 entry={**row,'proposal':proposal};results.append(entry)
 group=groups.setdefault(row['review_release'],[]);group.append((row,rgb,proposal))
 if j%100==0:print('Sampled',j,flush=True)
for release,entries in groups.items():
 entries.sort(key=lambda x:BY_ID[x[0]['profile_id']]['p'][0])
 for start in range(0,len(entries),10):
  selected=entries[start:start+10];panel=Image.new('RGB',(len(selected)*80,670),'#172b30');d=ImageDraw.Draw(panel)
  for j,(row,rgb,proposal) in enumerate(selected):
   panel.paste(Image.fromarray(rgb),(j*80,48));d.text((j*80+2,4),row['profile_id'].split('-')[-1],fill='white');d.text((j*80+2,17),row['date'][2:],fill='white');d.text((j*80+2,30),str(row['offset_m']),fill='#dddddd')
   d.line((j*80+31,48,j*80+31,648),fill='#cccc00')
   d.line((j*80,348,j*80+63,348),fill='#ff00ff')
   if row['offset_m'] is not None:
    y=348-row['offset_m']*2;d.line((j*80+14,y,j*80+49,y),fill='#22ccff',width=2)
   if 'offset_m' in proposal:
    y=348-proposal['offset_m']*2;d.line((j*80+7,y,j*80+56,y),fill='#00ff44' if proposal['accepted'] else '#ff5555',width=2)
  d.text((5,652),f'{release}; cyan=old; green=RGB candidate; pink=nominal axis zero. Classifier proposals, not field validation.',fill='white');panel.save(OUT/f'panel-{release}-{start:03}.png')
(OUT/(prefix+'proposals.json')).write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'proposed':len(results),'candidate_accepted':sum(r['proposal']['accepted'] for r in results)}),flush=True)
