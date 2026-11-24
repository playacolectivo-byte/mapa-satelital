"""Append independently interpreted, real-date Dzemul temporal contacts.

Never promotes classifier candidates; the lists are human image annotations.
All accepted endpoint proposals require official source-footprint verification.
"""
from pathlib import Path
import concurrent.futures,csv,datetime,hashlib,http.client,json,math,socket,urllib.parse
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/dzemul-audit-20261105';dest=ROOT/'public/data/shorelines/photo-alignment/manual-dzemul-20261105.json'
review=json.loads(dest.read_text(encoding='utf-8'));review['corrections']=[c for c in review['corrections'] if c['date'].startswith('2011')];review['sources']=[s for s in review['sources'] if s['capture_date'].startswith('2011')]
review['temporal_gaps']=[];review['reviewed_readings']=[]
review['rejected_readings']=[]
review['independent_review']={'scope':'2011 references only','report':'docs/qa/dzemul-independent-reference-review-20261105.json','operational_tolerance_m':8,'field_validated':False}
for correction in review['corrections']:correction['review_status']='independently_reviewed_2011_reference'
model={t['id']:t for t in json.loads((QA/'input-manifest.json').read_text(encoding='utf-8'))['profiles']};photos=json.loads((ROOT/'public/data/municipalities/dzemul/photos.json').read_text(encoding='utf-8'));items={i['releaseNum']:i for i in json.loads((ROOT/'public/data/history/esri-local-captures.json').read_text(encoding='utf-8'))['items']};refs={c['profile_id']:c['offset_m'] for c in review['corrections']}
offsets={
'2012':[
18,21,12,7,10,13,9,6,9,3,5,4,14,11,
14,17,14,12,9,0,-6,11,9,3,4,-3,1,-12,
-9,-3,2,-6,-4,1,-8,-7,-1,4,-3,-1,-5,-13,
-12,-13,-13,-14,-8,-10,-8,-8,-2,-1,5,11,13,0,
3,11,10,7,8,9,0,-8,-9,-13,-13,-8,-2,1,
-4,-8,-3,-6,-9,-14,-18,-9,-5,1,-3,-6,2,3,
6,8,5,8,6,-4,-1,-4,-8,-8,-12,-5,-11,-9,
-14,-14,-20,-20,-21,-19,-6,-8,-5,-7,-3,9,12,14,
10,8,3,5,5,6,7,2,3,4,7,11,11,13,
15,17,25,23,33,43,38,44],
'2015':[
22,17,18,16,21,14,11,6,11,3,14,11,18,18,
25,37,30,23,15,0,-4,18,18,12,7,11,12,-1,
6,1,5,-9,-7,1,-2,4,3,-7,-1,5,6,-9,
-3,-13,-8,-5,-10,3,11,6,3,10,7,12,8,-9,
0,7,11,5,4,5,12,11,8,7,9,12,14,7,
7,7,7,11,10,12,14,15,21,17,22,19,23,24],
'2013':[
-1,-9,-11,-9,-16,-15,-1,-2,-5,-9,-7,-9,-10,-19,
-16,-12,-1,-5,-5,-2,-5,11,6,8,6,5,6,-3,
0,-8,-12,-13,-13,-9,-9,-10,-14,-17,-22,-23,-29,-18,
-7,-6,-3,-7,-1,10,9,9],
'2025':[
-8,-8,-4,-16,5,10,9,5,1,-5,1,-8,-7,-6,
-1,9,-12,7,13,11,-1,-12,1,-3,1,-2,0,-7,
-5,-11,-1,-6,-9,-6,2,-10,-7,-2,-2,-1,-2,-14,
-11,-9,-5,-2,-8,-7,-2,-10,-12,-9,-6,-6,1,-5,
-2,-1,2,-1,-2,-2,-3,-7,-4,-3,-5,-7,-2,-11,
-11,-6,-6,-6,-3,-3,-3,1,0,-3,-3,-4,-3,2,
1,-5,-2,-1,-3,-1,-3,-2,-2,-4,-7,-5,-5,-6,
-7,-3,-5,-5,-9,-10,3,-1,-5,-4,-8,-6,-13,-10,
-10,-7,-7,-8,-1,-10,-6,-7,-8,-9,-8,-3,-7,-6,
-8,-9,-7,-8,-6,-10,-6,-4,1,-5,-10,-9,-6,-6,
2,-8,-5,-5,-7,-3]}
offsets['2022']=[
7,5,-2,-3,-1,-4,-3,-1,-1,-2,2,-1,3,1,
1,5,-5,2,1,-1,-6,-3,-1,4,1,-3,14,-6,
-3,-2,1,-7,-3,15,0,-3,-3,-1,0,5,3,-1,
4,8,2,-3,-10,1,1,0,1,4,5,1,-17,-1,
3,2,-1,-1,0,7,0,0,-5,-7,-7,0,3,2]
offsets['2023']=[
-3,3,-3,-7,1,1,3,1,3,-8,-4,-2,3,-7,
-3,5,1,-1,-4,-2,-3,7,3,2,-3,-2,2,-1,
-1,1,3,6,1,-8,-5,-9,5,6,-4,3,-5,2,
-8,1,4,2,1,-1,4,1,-6,3,-1,-6,-1,-1,
-3,-10,4,-5,-2,-2,-5,-9,-7,-4,-4,-6,-7,-3,
-2,-2,-5,-1,2,2,-1,-7,-4,-1,-2,2,-2,-1,
2,-4,-2,-4,-4,0,-4,2,-6,-5,-4,-7,-8,-4,
3,-1,1,-3,-9,-11,-11,-9,-4,-3,-6,-5,-9,-8,
-2,-4,-2,-2,-1,-1,-2,-1,-6,-3,-1]
offsets['2019']=[
7,11,11,3,2,-5,6,1,8,4,6,-3,1,-8,
-4,-6,5,-1,3,-3,10,2,6,-1,6,8,1,3,
11,10,9,8,7,5,3,4,5,6,7,8,-6,-10,
3,3,4,6,10,7,12,12,-3,-3,0,0,-5,-6,
24,23,8,8,-2,-2,-14,-14,-12,-12,-8,-9,11,10,
22,18,6,7,-5,-5,-7,-7,0,-1,0,-6,-1,-4,
20,27,12,10,6,-5,-6,-8,-9,8,0,7,5,18,
17,10,-1,-7,-11,-7,1,24,5,-3,-7,-7,17,8,
4,-3,17,10,-1,9,-3,-6,-5,-3,-3,0,-6,-3,
-2,8,7,6,8,2,-5,8,9,6,5,7,6,7,
8,11,11,6,7,8,6,4,0,6,3,7,10,4,
3,2,9,5,1,5,5,4,2,1,1,3,10,7,
10,8,8,12,7,8,6,5,13]
offsets['2020']=[
8,10,-1,-16,-9,-6,-7,-6,-7,-2,3,16,1,-1,
-8,-18,-11,10,13,0,-11,1,-2,1,-2,-5,1,2,
3,-1,-1,-6,-6,-6,-5,7,7,-6,-6,-9,-9,-3,
-3,0,1,-2,-1,-8,-7,-8,-8,-3,-3,21,21,14,
17,12,12,5,5,-6,-6,-7,-7,-9,-9,4,5,5,
5,4,4,1,2,2,3,0,1,1,1,7,8,8,
8,5,6,1,2,0,0,0,0,-3,-2,3,4,-1,
0,1,1,2,2,1,2,5,5,2,2,7,7,3,
4,1,1,-4,-3,0,0,1,2,-1,0,1,2,-3,
-2,-2,-2,2,2,1,1,3,3,2,2,2,3,6,
8,1,1,7,7,-3,-2,1,2,-1,-1,1,2,6,
8]
def coordinate(t,offset):
 lon,lat=t['p'];radius=6378137;scale=math.cos(math.radians(lat));x=radius*math.radians(lon)+t['v'][0]*offset/scale;y=radius*math.asinh(math.tan(math.radians(lat)))+t['v'][1]*offset/scale
 return [math.degrees(x/radius),math.degrees(math.atan(math.sinh(y/radius)))]
rows=[]
for year,values in offsets.items():
 series=json.loads((QA/f'year-{year}-rows.json').read_text(encoding='utf-8'));assert len(series)==len(values),(year,len(series),len(values))
 for n,(r,o) in enumerate(zip(series,values)):rows.append({**r,'manual_offset_m':o,'manual_panel_index':n,'coordinate':coordinate(model[r['profile_id']],o)})
lookup=socket.getaddrinfo;dns={}
def cached_lookup(host,port,*extra,**kw):
 key=(host,port,extra,tuple(sorted(kw.items())))
 if key not in dns:dns[key]=lookup(host,port,*extra,**kw)
 return dns[key]
socket.getaddrinfo=cached_lookup
def footprints(release):
 # Stable whole-municipality envelope prevents reusing a narrow cached query
 # when a later review adds readings from another footprint of that release.
 coords=[t['p']for t in model.values()];bounds=[min(p[0]for p in coords)-.002,min(p[1]for p in coords)-.002,max(p[0]for p in coords)+.002,max(p[1]for p in coords)+.002]
 params={'f':'json','where':'1=1','outFields':'SRC_DATE2,NICE_DESC,SRC_DESC,SAMP_RES,SRC_ACC','geometry':','.join(map(str,bounds)),'geometryType':'esriGeometryEnvelope','inSR':'4326','outSR':'4326','returnGeometry':'true','spatialRel':'esriSpatialRelIntersects'}
 url=items[release]['metadataLayerUrl']+'/6/query?'+urllib.parse.urlencode(params);path=QA/f'metadata-{release}-{hashlib.sha256(url.encode()).hexdigest()[:16]}-review-footprints.json'
 try:
  if path.exists():data=path.read_bytes()
  else:
   p=urllib.parse.urlsplit(url)
   for attempt in range(3):
    try:
     c=http.client.HTTPSConnection(p.netloc,timeout=20);c.request('GET',p.path+'?'+p.query,headers={'User-Agent':'ColectivoPlaya-Dzemul-QA/1.0'});response=c.getresponse();data=response.read();c.close();assert response.status==200;result=json.loads(data);assert 'features'in result,result;path.write_bytes(data);break
    except Exception:
     if attempt==2:raise
  result=json.loads(data);assert not result.get('exceededTransferLimit'),result
  return release,{'features':result['features'],'url':url,'sha256':hashlib.sha256(data).hexdigest()}
 except Exception as e:return release,{'features':[],'url':url,'error':type(e).__name__+': '+str(e)}
def inring(point,ring):
 x,y=point;inside=False
 for a,b in zip(ring,ring[1:]+ring[:1]):
  if(a[1]>y)!=(b[1]>y)and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
 return inside
def inside(p,f):return sum(inring(p,r)for r in f['geometry']['rings'])%2==1
with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:metadata=dict(pool.map(footprints,sorted({r['review_release']for r in rows})))
csvrows=[]
for r in rows:
 release=r['review_release'];meta=metadata[release];capture=photos['captures'][r['capture']];matching=[f for f in meta['features']if inside(r['coordinate'],f)];valid=[]
 for f in matching:
  a=f['attributes'];date=datetime.datetime.fromtimestamp(a['SRC_DATE2']/1000,datetime.timezone.utc).date().isoformat()
  if date==r['date']and a['SRC_DESC']==capture['source']:valid.append(f)
 n=r['manual_panel_index'];panel=QA/f'year-{r["date"][:4]}-{n//14*14:03}.png';source_id=f'dzemul-{release}-{r["profile_id"]}-c{r["capture"]}'
 source={'id':source_id,'release':release,'capture_date':r['date'],'screenshot_sha256':hashlib.sha256(panel.read_bytes()).hexdigest(),'panel':str(panel.relative_to(ROOT)),'panel_pixel':[32+n%14*80+31,148+2*(refs[r['profile_id']]-r['manual_offset_m'])],'coordinate':r['coordinate'],'metadata_url':meta['url'],'metadata_sha256':meta.get('sha256'),'metadata_endpoint_verified':len(valid)==1,'source_accuracy_m':capture['accuracy_m'],'source_resolution_m':capture['resolution_m'],'sampling_zoom':17}
 review['sources'].append(source)
 if len(valid)==1:review['corrections'].append({'profile_id':r['profile_id'],'capture':r['capture'],'date':r['date'],'releases':r['releases'],'original_offset_m':r['offset_m'],'original_accepted':r['accepted'],'offset_m':r['manual_offset_m'],'manual_uncertainty_m':8,'source':source_id,'review_status':'visually_interpreted_source_verified'})
 else:
  gap={'profile_id':r['profile_id'],'capture':r['capture'],'date':r['date'],'reason':'corrected_endpoint_metadata_not_verified','proposed_offset_m':r['manual_offset_m'],'source':source_id,'detail':meta.get('error')or{'covering_features':len(matching),'date_source_matches':len(valid)}}
  review['temporal_gaps'].append(gap);review['rejected_readings'].append({'profile_id':r['profile_id'],'capture':r['capture'],'date':r['date'],'releases':r['releases'],'reason':'capture_footprint_seam_at_visible_shoreline','visual_status':'pending','source':source_id})
 csvrows.append({'profile_id':r['profile_id'],'capture':r['capture'],'date':r['date'],'release':release,'old_offset_m':r['offset_m'],'old_accepted':r['accepted'],'manual_offset_m':r['manual_offset_m'],'manual_tolerance_m':8,'endpoint_source_verified':len(valid)==1,'source_panel':source['panel']})
for year,values in offsets.items():
 series=[r for r in rows if r['date'].startswith(year)]
 for start in range(0,len(series),14):
  panel=Image.open(QA/f'year-{year}-{start:03}.png').convert('RGB');draw=ImageDraw.Draw(panel)
  for j,r in enumerate(series[start:start+14]):
   y=148+2*(refs[r['profile_id']]-r['manual_offset_m']);draw.line((32+j*80+5,y,32+j*80+58,y),fill='#ff9020',width=2)
  panel.save(QA/f'manual-year-{year}-{start:03}.png')
review['notes']=[n for n in review['notes']if'other years are not newly approved'not in n and not n.startswith('Real 2015')];review['notes'].append('All 1,073 received dated photo readings from 2011 through 2025 were independently interpreted on retained date-labelled strips. A reading still remains pending when corrected-endpoint source metadata differs or cannot be established. Years without a real dated capture remain gaps.')
dest.write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
with(ROOT/'docs/qa/dzemul-manual-years-20261105.csv').open('w',encoding='utf-8',newline='')as f:
 writer=csv.DictWriter(f,fieldnames=list(csvrows[0]));writer.writeheader();writer.writerows(csvrows)
print(json.dumps({'manual_year_annotations':len(rows),'total_corrections':len(review['corrections']),'temporal_metadata_pending':len(review['temporal_gaps']),'metadata':{r:{k:v for k,v in m.items()if k!='features'}for r,m in metadata.items()}}),flush=True)
