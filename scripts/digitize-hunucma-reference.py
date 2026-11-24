"""Proposed manual Hunucma 2011 references, awaiting an independent visual pass.

Numbers are operator annotations on the retained original-source panels.
Automatic colour candidates are deliberately NOT used as accepted readings.
"""
from pathlib import Path
import argparse,concurrent.futures,datetime,hashlib,json,math,socket,urllib.parse,urllib.request
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/hunucma-audit-20261105';SOURCE=QA/'release-11019'
manifest=json.loads((SOURCE/'manifest.json').read_text(encoding='utf-8'))
parser=argparse.ArgumentParser()
parser.add_argument('--metadata-ip',help='A freshly DNS-resolved IPv4 for a process-local resolver cache; TLS still validates the original hostname.')
args=parser.parse_args()
if args.metadata_ip:
 socket.inet_pton(socket.AF_INET,args.metadata_ip)
 original_getaddrinfo=socket.getaddrinfo
 def cached_getaddrinfo(host,port,*extra,**kwargs):
  if host=='metadata.maptiles.arcgis.com':
   return original_getaddrinfo(args.metadata_ip,port,*extra,**kwargs)
  return original_getaddrinfo(host,port,*extra,**kwargs)
 socket.getaddrinfo=cached_getaddrinfo
model=json.loads((ROOT/'public/data/municipalities/hunucma/scenario.json').read_text(encoding='utf-8'));photos=json.loads((ROOT/'public/data/municipalities/hunucma/photos.json').read_text(encoding='utf-8'));photo_rows={t['id']:t for t in photos['targets']}
raw=(ROOT/'public/data/shorelines/photo-alignment/revised-data.json').read_bytes()
items=json.loads((ROOT/'public/data/history/esri-local-captures.json').read_text(encoding='utf-8'))['items'];item=next(i for i in items if i['releaseNum']==11019)
rows=[
 323,319,313,307,297,287,302,326,333,335,350,353,355,355,
 391,397,399,404,404,408,395,389,381,368,365,357,351,347,
 302,296,282,278,285,300,302,303,308,311,313,309,317,337,
 350,370,397,407,408,414,416,424,422,425,430,429,437,431,
 399,410,411,337,326,326,322,309,306,295,295,300,305,301,
 299,299,301,306,325,318,310,299,291,294,313,309,302,297,
 310,311,308,309,301,289,285,278,269,266,275,286,274,255,
 253,256,285,308,313,315,308,288,286,294,313,323,318,333,
 352,359,382,433,432,510,526,510,537,577,594,590,None,None,
 None,None,283,309,352,376,394,398,393,386,375,363,344,322,
 278,266,269,284,282,276,273,282,286,289,294,308,318,312,
 316,305,304]
assert len(rows)==len(manifest['profiles'])==157
review={'version':1,'status':'proposed_for_independent_visual_review','method':'manual-hunucma-apparent-water-sand-2011-20261105','field_validated':False,'data_sha256':hashlib.sha256(raw).hexdigest(),'model_sha256':photos['model_sha256'],'reference_year':2011,'reference_date':'2011-08-01','reference_capture':40,'sources':[],'corrections':[],'reference_captures':[],'reference_gaps':[],'rejected_readings':[],'notes':['Manual interpretation of the contiguous apparent water/sand boundary; no tide, wave, beach-slope or relative-registration correction.','8m operational interpretation tolerance is not a standard deviation or certified accuracy.','No 2010/2012 photo may masquerade as a 2011 reference.','The four ambiguous/out-of-window profiles remain pending.','Other years have not been newly approved by this reference-only overlay.']}
compiled=QA/'reviewed-readings.json'
if compiled.exists():
 later=json.loads(compiled.read_text(encoding='utf-8'))
 assert later['photos_sha256']==hashlib.sha256((ROOT/'public/data/municipalities/hunucma/photos.json').read_bytes()).hexdigest()
 review['reviewed_readings']=later['records']
native_ids={t['id'] for t in manifest['profiles']}
for t in model['targets']:
 if t['type'].startswith('Playa') and t['id'] not in native_ids:review['reference_gaps'].append({'profile_id':t['id'],'year':2011,'reason':'no_dated_2011_photograph_in_received_inventory'})
for n,t in enumerate(manifest['profiles']):
 reading=next(r for r in photo_rows[t['id']]['readings'] if 11019 in r['releases']);capture=photos['captures'][reading['capture']]
 assert capture['date']=='2011-08-01'
 if rows[n] is None:review['reference_gaps'].append({'profile_id':t['id'],'year':2011,'reason':'ambiguous_inlet_or_shore_outside_150m_sample_window','source_panel':f'profiles-{n//14*14:03}.png'})
def build(task):
 n,t,y=task;reading=next(r for r in photo_rows[t['id']]['readings'] if 11019 in r['releases']);capture=photos['captures'][reading['capture']];offset=(340-y)/2
 lon,lat=t['p'];radius=6378137;scale=math.cos(math.radians(lat));x=radius*math.radians(lon)+t['v'][0]*offset/scale;yy=radius*math.asinh(math.tan(math.radians(lat)))+t['v'][1]*offset/scale;coordinate=[math.degrees(x/radius),math.degrees(math.atan(math.sinh(yy/radius)))]
 params={'f':'json','where':'1=1','outFields':'SRC_DATE2,NICE_DESC,SRC_DESC,SAMP_RES,SRC_ACC','geometry':json.dumps({'spatialReference':{'wkid':4326},'x':coordinate[0],'y':coordinate[1]}),'geometryType':'esriGeometryPoint','returnGeometry':'false','spatialRel':'esriSpatialRelIntersects'}
 url=item['metadataLayerUrl']+'/6/query?'+urllib.parse.urlencode(params);key=hashlib.sha256(url.encode()).hexdigest()[:16];dest=QA/f'endpoint-metadata/{t["id"]}-{key}.json'
 try:
  if dest.exists():data=dest.read_bytes()
  else:
   for attempt in range(3):
    try:
     with urllib.request.urlopen(url,timeout=30) as response:data=response.read()
     break
    except Exception:
     if attempt==2:raise
   dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
  result=json.loads(data);assert len(result.get('features',[]))==1,result
  attributes=result['features'][0]['attributes'];actual=datetime.datetime.fromtimestamp(attributes['SRC_DATE2']/1000,datetime.timezone.utc).date().isoformat()
  if actual!=capture['date'] or attributes['SRC_DESC']!=capture['source']:return None,None,{'profile_id':t['id'],'year':2011,'reason':'corrected_endpoint_has_different_source','expected_date':capture['date'],'actual_date':actual,'metadata_url':url}
 except Exception as e:return None,None,{'profile_id':t['id'],'year':2011,'reason':'source_endpoint_metadata_not_verified','detail':str(e),'metadata_url':url}
 source_id=f'hunucma-11019-{t["id"]}';panel=SOURCE/f'profiles-{n//14*14:03}.png'
 source={'id':source_id,'release':11019,'capture_date':capture['date'],'screenshot_sha256':hashlib.sha256(panel.read_bytes()).hexdigest(),'panel':str(panel.relative_to(ROOT)),'panel_pixel':[(n%14)*80+39.5,y],'coordinate':coordinate,'metadata_url':url,'metadata_sha256':hashlib.sha256(data).hexdigest(),'source_accuracy_m':capture['accuracy_m'],'source_resolution_m':capture['resolution_m']}
 correction={'profile_id':t['id'],'capture':reading['capture'],'date':capture['date'],'releases':reading['releases'],'original_offset_m':reading['offset_m'],'original_accepted':reading['accepted'],'offset_m':offset,'manual_uncertainty_m':8,'source':source_id}
 return source,correction,None
print('Verifying 153 individually annotated endpoints, two workers maximum.',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for source,correction,gap in pool.map(build,[(n,t,y) for n,(t,y) in enumerate(zip(manifest['profiles'],rows)) if y is not None]):
  if source:
   review['sources'].append(source);review['corrections'].append(correction)
   review['reference_captures'].append({'profile_id':correction['profile_id'],'capture':correction['capture'],'date':correction['date']})
  else:review['reference_gaps'].append(gap)
dest=ROOT/'public/data/shorelines/photo-alignment/manual-hunucma-20261105.json';temporary=dest.with_suffix('.json.tmp');temporary.write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');temporary.replace(dest)
for start in range(0,len(rows),14):
 panel=Image.open(SOURCE/f'profiles-{start:03}.png').convert('RGB');draw=ImageDraw.Draw(panel)
 for j,y in enumerate(rows[start:start+14]):
  if y is not None:draw.line((j*80+13,y,j*80+66,y),fill='#ff3020',width=2)
  else:draw.text((j*80+2,330),'PENDING',fill='#ffb000')
 panel.save(SOURCE/f'manual-{start:03}.png')
print(json.dumps({'proposed_corrections':len(review['corrections']),'reference_gaps':len(review['reference_gaps']),'available2011':len(review['reference_captures']),'overlay':str(dest)}),flush=True)
