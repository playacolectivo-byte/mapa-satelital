"""Combine explicit visual decisions and verify every dated 2011 endpoint.

Detector proposals never become observations without a recorded visual choice.
The user's literal white-line guides keep precedence over every new annotation.
"""
from pathlib import Path
import datetime,hashlib,http.client,json,math,urllib.parse
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/progreso-full-review-20261105'
def read(p):return json.loads((ROOT/p).read_text(encoding='utf-8'))
inventory=read('work/progreso-full-review-20261105/baseline-inventory.json')['records']
proposals=read('work/progreso-full-review-20261105/baseline-proposals.json')
operator=read('docs/qa/progreso-root-baseline-308-591-20261105.json')
independent=read('docs/qa/progreso-independent-baseline-000-294-20261105.json')
guides=read('public/data/shorelines/photo-alignment/user-guides-2011-20261105.json')
before_path=QA/'before-full-photos.json'
if not before_path.exists():before_path.write_bytes((ROOT/'public/data/municipalities/progreso/photos.json').read_bytes())
photos=json.loads(before_path.read_text(encoding='utf-8'));lookup={t['id']:t for t in photos['targets']}
model=read('public/data/municipalities/progreso/scenario.json');targets={t['id']:t for t in model['targets']}
ordered=sorted(inventory,key=lambda r:(r['p'][0],r['p'][1]));records={r['profile_id']:r for r in inventory}
raw=(ROOT/'public/data/shorelines/photo-alignment/revised-data.json').read_bytes()
decisions={r['profile_id']:{'offset_m':r['offset_m'],'panel':r['evidence_panel'],'decision':r['decision']} for r in independent['reviewed_readings']}
pending={r['profile_id']:'structure_prevents_unique_sand_water_intersection' for r in independent['pending']}
for start,rows in operator['rows_by_panel'].items():
 for j,y in enumerate(rows):
  r=ordered[int(start)+j]
  if y is None:pending[r['profile_id']]='structure_prevents_unique_sand_water_intersection';continue
  decisions[r['profile_id']]={'offset_m':round((345-y)/2,1),'panel':f'work/progreso-full-review-20261105/baseline-proposals-{int(start):03}.png','decision':'manual_visible_sand_water_boundary'}
for suffix,y in zip(range(20,24),[343,335,333,350]):
 decisions[f'SC-88-0-{suffix}']={'offset_m':round((345-y)/2,1),'panel':'work/progreso-year-review-20261105/baseline-gap-000.png','decision':'manual_visible_sand_water_boundary_after_source_retry'}
for r in ordered[:5]:
 original=next(x for x in lookup[r['profile_id']]['readings'] if x['capture']==40)
 assert original['accepted'] and original['offset_m'] is not None
 decisions[r['profile_id']]={'offset_m':original['offset_m'],'panel':'work/progreso-full-review-20261105/baseline-proposals-000.png','decision':'user_confirmed_first_five_retained_after_two_visual_checks'}
def coordinate(t,offset):
 lon,lat=t['p'];radius=6378137;scale=math.cos(math.radians(lat));x=radius*math.radians(lon)+t['v'][0]*offset/scale;y=radius*math.asinh(math.tan(math.radians(lat)))+t['v'][1]*offset/scale
 return [math.degrees(x/radius),math.degrees(math.atan(math.sinh(y/radius)))]
coords=[coordinate(targets[k],v['offset_m']) for k,v in decisions.items()]
bounds=[min(p[0] for p in coords)-.0002,min(p[1] for p in coords)-.0002,max(p[0] for p in coords)+.0002,max(p[1] for p in coords)+.0002]
item=next(i for i in read('public/data/history/esri-local-captures.json')['items'] if i['releaseNum']==11019)
params={'f':'json','where':'1=1','outFields':'SRC_DATE2,NICE_DESC,SRC_DESC,SAMP_RES,SRC_ACC','geometry':','.join(map(str,bounds)),'geometryType':'esriGeometryEnvelope','inSR':'4326','outSR':'4326','returnGeometry':'true','spatialRel':'esriSpatialRelIntersects'}
url=item['metadataLayerUrl']+'/6/query?'+urllib.parse.urlencode(params);cache=QA/'baseline-corrected-endpoint-footprints.json'
if cache.exists():data=cache.read_bytes()
else:
 parsed=urllib.parse.urlsplit(url)
 for attempt in range(4):
  try:
   con=http.client.HTTPSConnection(parsed.netloc,timeout=30);con.request('GET',parsed.path+'?'+parsed.query);res=con.getresponse();data=res.read();con.close();assert res.status==200;result=json.loads(data);assert 'features' in result;cache.write_bytes(data);break
  except Exception:
   if attempt==3:raise
result=json.loads(data);assert not result.get('exceededTransferLimit')
def inring(point,ring):
 x,y=point;inside=False
 for a,b in zip(ring,ring[1:]+ring[:1]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
 return inside
def matches(p,c):
 return [f for f in result['features'] if sum(inring(p,r) for r in f['geometry']['rings'])%2==1 and datetime.datetime.fromtimestamp(f['attributes']['SRC_DATE2']/1000,datetime.timezone.utc).date().isoformat()==c['date'] and f['attributes']['SRC_DESC']==c['source']]
crosscheck=read('docs/qa/progreso-hunucma-independent-review-20261105.json')
assert crosscheck['status']=='visual_review_complete'
review={'version':1,'status':'independently_reviewed','method':'manual-progreso-apparent-water-sand-2011-20261105','field_validated':False,'data_sha256':hashlib.sha256(raw).hexdigest(),'model_sha256':photos['model_sha256'],'reference_year':2011,'sources':list(guides['sources']),'corrections':[],'reference_captures':[],'reference_gaps':[],'rejected_readings':[],'reviewed_readings':[],'notes':['47 user-drawn guide intersections have priority and remain unchanged.','All other published baseline positions require explicit visual choices and actual endpoint metadata coverage.','8m is an operational interpretation tolerance, not a certified positional accuracy or a standard deviation.','No tide, wave, beach-slope or relative registration correction has been established.']}
guide_ids={r['profile_id'] for r in guides['corrections']}
for t in model['targets']:
 if not t['type'].startswith('Playa'):continue
 id=t['id'];r=next(r for r in lookup[id]['readings'] if r['capture']==40);c=photos['captures'][40]
 if id in guide_ids:
  review['reference_captures'].append({'profile_id':id,'capture':40,'date':c['date']});review['reviewed_readings'].append({'profile_id':id,'capture':40,'releases':[11019],'visual_status':'accepted'});continue
 decision=decisions.get(id)
 if not decision:
  review['reference_gaps'].append({'profile_id':id,'year':2011,'reason':pending.get(id,'source_tiles_unavailable_for_visual_review')});continue
 point=coordinate(t,decision['offset_m']);matched=matches(point,c)
 if len(matched)!=1:review['reference_gaps'].append({'profile_id':id,'year':2011,'reason':'corrected_endpoint_metadata_not_unique','proposed_offset_m':decision['offset_m']});continue
 panel=ROOT/decision['panel'];source_id='progreso-11019-'+id
 review['sources'].append({'id':source_id,'release':11019,'capture_date':c['date'],'screenshot_sha256':hashlib.sha256(panel.read_bytes()).hexdigest(),'panel':decision['panel'],'coordinate':point,'metadata_url':url,'metadata_sha256':hashlib.sha256(data).hexdigest(),'metadata_endpoint_verified':True,'source_accuracy_m':c['accuracy_m'],'source_resolution_m':c['resolution_m'],'decision':decision['decision']})
 review['corrections'].append({'profile_id':id,'capture':40,'date':c['date'],'releases':r['releases'],'original_offset_m':r['offset_m'],'original_accepted':r['accepted'],'offset_m':decision['offset_m'],'manual_uncertainty_m':8,'source':source_id})
 review['reference_captures'].append({'profile_id':id,'capture':40,'date':c['date']})
for temporal_path,report_path,group in [
 ('work/progreso-year-review-20261105/approved-years.json','docs/qa/progreso-2015-independent-visual-review-20261105.json','2015'),
 ('work/progreso-year-review-20261105/approved-years.json','docs/qa/progreso-latest-independent-visual-review-20261105.json','latest'),
 ('work/progreso-remaining-review-20261105/approved-remaining.json','docs/qa/progreso-remaining-independent-review-20261105.json','remaining')]:
 if not (ROOT/temporal_path).exists() or not (ROOT/report_path).exists():continue
 report=read(report_path)
 assert report.get('status') in ['independent_visual_review_complete','independent_visual_review_completed','visual_review_complete_source_checks_pass']
 if group=='remaining':assert report.get('expected_readings')==3180 and report.get('readings_reviewed')==3180
 temporal=read(temporal_path);assert temporal['data_sha256']==review['data_sha256']
 keys=None if group=='remaining' else {(r['profile_id'],r['capture'],r['release']) for r in read('work/progreso-year-review-20261105/'+group+'-proposals.json')['rows']}
 sources=[s for s in temporal['sources'] if group=='remaining' or s['id'].startswith('progreso-'+group+'-')];allowed={s['id'] for s in sources}
 review['sources'].extend(sources)
 review['corrections'].extend(c for c in temporal['corrections'] if c['source'] in allowed)
 review['reviewed_readings'].extend(r for r in temporal.get('reviewed_readings',[]) if r.get('source') in allowed or group=='remaining')
 review['rejected_readings'].extend(r for r in temporal.get('rejected_readings',[]) if keys is None or any((r['profile_id'],r['capture'],v) in keys for v in r['releases']))
 review.setdefault('pending_readings',[]).extend(r for r in temporal.get('pending_readings',[]) if keys is None or any((r['profile_id'],r['capture'],v) in keys for v in r['releases']))
 review.setdefault('independent_temporal_reports',[]).append({'group':group,'report':report_path,'verified_sources':len(sources)})
for start in range(0,len(ordered),14):
 panel=Image.open(QA/f'baseline-proposals-{start:03}.png').convert('RGB');draw=ImageDraw.Draw(panel)
 for j,r in enumerate(ordered[start:start+14]):
  d=decisions.get(r['profile_id'])
  if d is not None:y=345-2*d['offset_m'];draw.line((44+j*80+5,y,44+j*80+74,y),fill='#ff9020',width=2)
 panel.save(QA/f'baseline-manual-{start:03}.png')
path=ROOT/'public/data/shorelines/photo-alignment/manual-progreso-full-20261105.json';path.write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'references':len(review['reference_captures']),'new_corrections':len(review['corrections']),'user_guides_preserved':len(guide_ids),'pending':review['reference_gaps']}),flush=True)
