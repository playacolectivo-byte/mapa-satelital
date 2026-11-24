"""Build a separate reference overlay from intersections with the user's pixels."""
from pathlib import Path
import concurrent.futures,datetime,hashlib,json,math,urllib.parse,urllib.request
import numpy as np
import cv2
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/shoreline-user-guides-20261105'
reg=json.loads((QA/'registration.json').read_text(encoding='utf-8'));crossings=json.loads((QA/'crossings.json').read_text(encoding='utf-8'))
snapshot=QA/'before-photos.json'
if not snapshot.exists():snapshot.write_bytes((ROOT/'public/data/municipalities/progreso/photos.json').read_bytes())
before=json.loads(snapshot.read_text(encoding='utf-8'));raw=(ROOT/'public/data/shorelines/photo-alignment/revised-data.json').read_bytes();original=json.loads(raw)
targets={t['id']:t for t in reg['profiles']};items=json.loads((ROOT/'public/data/history/esri-local-captures.json').read_text(encoding='utf-8'))['items'];item=next(i for i in items if i['releaseNum']==11019)
SIZE=256*2**reg['zoom'];origin=np.array(reg['origin_pixel'])
def pixel(p):return np.array([(p[0]+180)/360*SIZE,(1-math.asinh(math.tan(math.radians(p[1])))/math.pi)/2*SIZE])-origin
choices={}
for c in crossings:
 guide=reg['guides'][c['guide']-1];t=targets[c['profile_id']];A=np.array(guide['affine_screen_to_mosaic']);inv=cv2.invertAffineTransform(A)
 # Two annotations contain a small backward-drawn stub. Select the continuous
 # upper stroke, not the redundant horizontal tail; retain all alternatives.
 offset=max(c['offset_candidates_m'])
 normal=np.array([t['v'][0],-t['v'][1]]);mpp=156543.03392804097*math.cos(math.radians(t['p'][1]))/2**reg['zoom']
 native=pixel(t['p'])+normal*offset/mpp;screen=native@inv[:,:2].T+inv[:,2];margin=min(screen[0],guide['size'][0]-screen[0])
 c={**c,'offset_m':round(offset,2),'screen_pixel':screen.tolist(),'mosaic_pixel':native.tolist(),'horizontal_margin_px':float(margin)}
 choices.setdefault(c['profile_id'],[]).append(c)
review={'version':1,'method':'user-drawn-shoreline-2011-20261105','field_validated':False,'data_sha256':hashlib.sha256(raw).hexdigest(),'model_sha256':original['model_sha256'],'reference_date':'2011-08-01','reference_capture':40,'scope':'Only existing beach profiles that intersect the white user annotation. Other dates are not newly certified by this reference correction.','overlap_policy':'Choose the capture with the largest horizontal margin at the crossing; retain every alternative.','source_zoom':reg['zoom'],'guides':reg['guides'],'sources':[],'corrections':[],'alternatives':[]}
def build(pair):
 id,alternatives=pair;c=max(alternatives,key=lambda c:c['horizontal_margin_px']);t=targets[id];guide=reg['guides'][c['guide']-1]
 reading=next(r for r in next(t for t in before['targets'] if t['id']==id)['readings'] if 11019 in r['releases']);capture=original['captures'][reading['capture']];assert capture['date']=='2011-08-01' and reading['capture']==40
 lon,lat=t['p'];radius=6378137;scale=math.cos(math.radians(lat));x=radius*math.radians(lon)+t['v'][0]*c['offset_m']/scale;y=radius*math.asinh(math.tan(math.radians(lat)))+t['v'][1]*c['offset_m']/scale
 coord=[math.degrees(x/radius),math.degrees(math.atan(math.sinh(y/radius)))]
 params={'f':'json','where':'1=1','outFields':'SRC_DATE2,NICE_DESC,SRC_DESC,SAMP_RES,SRC_ACC','geometry':json.dumps({'spatialReference':{'wkid':4326},'x':coord[0],'y':coord[1]}),'geometryType':'esriGeometryPoint','returnGeometry':'false','spatialRel':'esriSpatialRelIntersects'}
 url=item['metadataLayerUrl']+'/6/query?'+urllib.parse.urlencode(params);key=hashlib.sha256(url.encode()).hexdigest()[:16];dest=QA/f'metadata/{id}-{key}.json'
 if dest.exists():data=dest.read_bytes()
 else:
  for attempt in range(3):
   try:
    with urllib.request.urlopen(url,timeout=30) as r:data=r.read()
    break
   except Exception:
    if attempt==2:raise
  dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
 result=json.loads(data);assert len(result.get('features',[]))==1,(id,result)
 a=result['features'][0]['attributes'];date=datetime.datetime.fromtimestamp(a['SRC_DATE2']/1000,datetime.timezone.utc).date().isoformat();assert date==capture['date'] and a['SRC_DESC']==capture['source'],(id,a,capture)
 source_id=f'user-guide-{c["guide"]}-{id}'
 source={'id':source_id,'release':11019,'capture_date':date,'screenshot_sha256':guide['sha256'],'guide':c['guide'],'screen_pixel':c['screen_pixel'],'mosaic_pixel':c['mosaic_pixel'],'coordinate':coord,'metadata_url':url,'metadata_sha256':hashlib.sha256(data).hexdigest(),'registration_p95_native_px':guide['p95_error_native_px']}
 correction={'profile_id':id,'capture':40,'date':date,'releases':reading['releases'],'original_offset_m':reading['offset_m'],'original_accepted':reading['accepted'],'offset_m':c['offset_m'],'manual_uncertainty_m':2,'source':source_id}
 return source,correction,{'profile_id':id,'selected_guide':c['guide'],'crossings':alternatives}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 for s,c,a in pool.map(build,choices.items()):review['sources'].append(s);review['corrections'].append(c);review['alternatives'].append(a)
dest=ROOT/'public/data/shorelines/photo-alignment/user-guides-2011-20261105.json';dest.write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'profiles':len(choices),'overlaps':sum(len(v)>1 for v in choices.values()),'verified_endpoints':len(review['sources'])}),flush=True)
