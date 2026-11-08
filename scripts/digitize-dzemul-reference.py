"""Retain the operator's Dzemul 2011 apparent water/sand annotations.

An independent reviewer must assess these proposals before app integration.
RGB detector outputs are never copied into manual annotations.
"""
from pathlib import Path
import argparse,csv,datetime,hashlib,http.client,json,math,socket,urllib.parse
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/dzemul-audit-20261105'
parser=argparse.ArgumentParser();parser.add_argument('--metadata-ip');args=parser.parse_args()
if args.metadata_ip:
 socket.inet_pton(socket.AF_INET,args.metadata_ip);lookup=socket.getaddrinfo
 def local_lookup(host,port,*extra,**kw):return lookup(args.metadata_ip if host=='metadata.maptiles.arcgis.com' else host,port,*extra,**kw)
 socket.getaddrinfo=local_lookup
model=json.loads((ROOT/'public/data/municipalities/dzemul/scenario.json').read_text(encoding='utf-8'))
photos=json.loads((ROOT/'public/data/municipalities/dzemul/photos.json').read_text(encoding='utf-8'))
targets=sorted(model['targets'],key=lambda t:t['p'][0]);photo_rows={t['id']:t for t in photos['targets']}
raw=(ROOT/'public/data/shorelines/photo-alignment/revised-data.json').read_bytes()
item=next(i for i in json.loads((ROOT/'public/data/history/esri-local-captures.json').read_text(encoding='utf-8'))['items'] if i['releaseNum']==11019)
# Integer metres, rounded from visually interpreted contact on retained z17
# strips. Positive follows the model seaward normal. Operational tolerance 8m.
offsets=[
12,13,13,8,10,12,10,7,13,8,
8,10,16,15,15,17,18,13,12,9,
0,5,10,8,6,-1,1,-8,-11,-16,
-12,-12,-8,-7,-6,-16,-16,-13,-12,-10,
-9,-20,-21,-20,-20,-17,-24,-20,-14,-15,
-17,-8,0,3,-3,-10,-6,2,3,5,
-1,-1,-5,-16,-11,-30,-24,-13,-7,-4,
-13,-8,-6,-8,-7,-13,-18,-16,-10,-3,
-1,-4,-4,11,4,4,4,5,7,-2,
-6,-3,-8,-7,-13,-12,-18,-14,-14,-13,
-18,-25,-24,-25,-21,-16,-1,-8,-7,-1,
13,18,11,4,1,7,6,0,4,0,
1,5,2,12,9,12,19,21,21,15,
29,40,37,34]
assert len(offsets)==len(targets)==134
def coordinate(t,offset):
 lon,lat=t['p'];radius=6378137;scale=math.cos(math.radians(lat));x=radius*math.radians(lon)+t['v'][0]*offset/scale;y=radius*math.asinh(math.tan(math.radians(lat)))+t['v'][1]*offset/scale
 return [math.degrees(x/radius),math.degrees(math.atan(math.sinh(y/radius)))]
coords=[coordinate(t,o) for t,o in zip(targets,offsets)]
bounds=[min(p[0] for p in coords)-.0001,min(p[1] for p in coords)-.0001,max(p[0] for p in coords)+.0001,max(p[1] for p in coords)+.0001]
params={'f':'json','where':'1=1','outFields':'SRC_DATE2,NICE_DESC,SRC_DESC,SAMP_RES,SRC_ACC','geometry':','.join(str(x) for x in bounds),'geometryType':'esriGeometryEnvelope','inSR':'4326','outSR':'4326','returnGeometry':'true','spatialRel':'esriSpatialRelIntersects'}
url=item['metadataLayerUrl']+'/6/query?'+urllib.parse.urlencode(params);path=QA/'metadata-11019-corrected-endpoint-footprints.json'
try:
 if path.exists():data=path.read_bytes()
 else:
  parsed=urllib.parse.urlsplit(url)
  for attempt in range(3):
   try:
    connection=http.client.HTTPSConnection(parsed.netloc,timeout=25);connection.request('GET',parsed.path+'?'+parsed.query,headers={'User-Agent':'ColectivoPlaya-Dzemul-QA/1.0'});response=connection.getresponse();data=response.read();connection.close();assert response.status==200;result=json.loads(data);assert 'features' in result,result;path.write_bytes(data);break
   except Exception:
    if attempt==2:raise
 result=json.loads(data);assert not result.get('exceededTransferLimit'),result
 metadata_error=None
except Exception as e:result={'features':[]};data=b'';metadata_error=type(e).__name__+': '+str(e)
def inring(point,ring):
 x,y=point;inside=False
 for a,b in zip(ring,ring[1:]+ring[:1]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
 return inside
def inside(point,feature):
 return sum(inring(point,ring) for ring in feature['geometry']['rings'])%2==1
review={'version':1,'status':'proposed_for_independent_visual_review','method':'manual-dzemul-apparent-water-sand-2011-20261105','field_validated':False,'data_sha256':hashlib.sha256(raw).hexdigest(),'model_sha256':photos['model_sha256'],'reference_year':2011,'reference_date':'2011-08-01','reference_capture':40,'sources':[],'corrections':[],'reference_captures':[],'reference_gaps':[],'rejected_readings':[],'reviewed_profiles':[],'notes':['134 apparent water/sand contacts interpreted visually on retained original Wayback z17 strips. RGB proposals are not treated as manual observations.','Integer metre rounding; 8m is an operational interpretation tolerance, not a standard deviation or certified accuracy.','No tide, wave setup, beach slope or relative image registration correction has been established.','These are independent-review proposals; other years are not newly approved by this reference overlay.']}
rows=[]
for n,(t,offset,point) in enumerate(zip(targets,offsets,coords)):
 reading=next(r for r in photo_rows[t['id']]['readings'] if r['capture']==40);capture=photos['captures'][40];assert capture['date']=='2011-08-01'
 review['reference_captures'].append({'profile_id':t['id'],'capture':40,'date':capture['date']});review['reviewed_profiles'].append(t['id'])
 matching=[f for f in result['features'] if inside(point,f)];date_matches=[]
 for feature in matching:
  a=feature['attributes'];actual=datetime.datetime.fromtimestamp(a['SRC_DATE2']/1000,datetime.timezone.utc).date().isoformat()
  if actual==capture['date'] and a['SRC_DESC']==capture['source']:date_matches.append(feature)
 gap=None
 if len(date_matches)!=1:
  gap={'profile_id':t['id'],'year':2011,'reason':'corrected_endpoint_metadata_not_verified','detail':metadata_error or {'covering_features':len(matching),'dated_source_matches':len(date_matches)},'proposed_offset_m':offset};review['reference_gaps'].append(gap)
 source_id='dzemul-11019-'+t['id'];panel=QA/f'baseline-grid-11019-{n//10*10:03}.png'
 source={'id':source_id,'release':11019,'capture_date':capture['date'],'screenshot_sha256':hashlib.sha256(panel.read_bytes()).hexdigest(),'panel':str(panel.relative_to(ROOT)),'panel_pixel':[n%10*80+63,348-offset*2],'coordinate':point,'metadata_url':url,'metadata_sha256':hashlib.sha256(data).hexdigest() if data else None,'metadata_endpoint_verified':gap is None,'source_accuracy_m':capture['accuracy_m'],'source_resolution_m':capture['resolution_m'],'sampling_zoom':17}
 review['sources'].append(source)
 if gap is None:review['corrections'].append({'profile_id':t['id'],'capture':40,'date':capture['date'],'releases':reading['releases'],'original_offset_m':reading['offset_m'],'original_accepted':reading['accepted'],'offset_m':offset,'manual_uncertainty_m':8,'source':source_id})
 rows.append({'profile_id':t['id'],'date':capture['date'],'old_offset_m':reading['offset_m'],'old_accepted':reading['accepted'],'manual_offset_m':offset,'manual_tolerance_m':8,'metadata_verified':gap is None,'source_panel':source['panel']})
dest=ROOT/'public/data/shorelines/photo-alignment/manual-dzemul-20261105.json';dest.write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
with (ROOT/'docs/qa/dzemul-manual-reference-20261105.csv').open('w',encoding='utf-8',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
for start in range(0,134,10):
 panel=Image.open(QA/f'baseline-grid-11019-{start:03}.png').convert('RGB');draw=ImageDraw.Draw(panel)
 for j,offset in enumerate(offsets[start:start+10]):
  y=348-offset*2;draw.line((32+j*80+7,y,32+j*80+56,y),fill='#ff9020',width=2)
 panel.save(QA/f'manual-reference-{start:03}.png')
print(json.dumps({'proposed_corrections':len(review['corrections']),'metadata_pending':len(review['reference_gaps']),'reviewed_profiles':len(rows),'footprints':len(result['features']),'metadata_error':metadata_error,'overlay':str(dest)}),flush=True)
