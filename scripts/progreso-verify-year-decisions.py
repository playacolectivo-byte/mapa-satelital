"""Verify each human-reviewed Progreso endpoint against official point metadata.

Writes QA only; transport/ambiguous footprints remain pending, date/sensor mismatches rejected.
"""
from pathlib import Path
import argparse,concurrent.futures,datetime,functools,hashlib,json,math,socket,urllib.parse,urllib.request
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/progreso-year-review-20261105'
parser=argparse.ArgumentParser();parser.add_argument('--group',default='2015');parser.add_argument('--metadata-ip');parser.add_argument('--footprints',action='store_true');parser.add_argument('--point-crosscheck-step',type=int,default=50);args=parser.parse_args()
original_getaddrinfo=socket.getaddrinfo
if args.metadata_ip:
    socket.inet_pton(socket.AF_INET,args.metadata_ip)
    def cached_resolver(host,port,*extra,**kwargs):return original_getaddrinfo(args.metadata_ip if host=='metadata.maptiles.arcgis.com' else host,port,*extra,**kwargs)
    socket.getaddrinfo=cached_resolver
else:socket.getaddrinfo=functools.lru_cache(maxsize=64)(original_getaddrinfo)
catalogue={i['releaseNum']:i for i in json.loads((ROOT/'public/data/history/esri-local-captures.json').read_text(encoding='utf-8'))['items']}
input_path=QA/f'{args.group}-decisions.json';decisions=json.loads(input_path.read_text(encoding='utf-8'))
rows=decisions['reviewed_readings'];pending=decisions.get('pending',[]);dest=ROOT/f'docs/qa/progreso-{args.group}-endpoint-review-20261105.json'
footprints={}
if args.footprints:
    for item in json.loads((QA/f'{args.group}-footprints.json').read_text(encoding='utf-8')):
        if item['status']!='valid_official_footprint_geometry':continue
        data=(ROOT/item['cache']).read_bytes();assert hashlib.sha256(data).hexdigest()==item['sha256'];result=json.loads(data);assert result.get('spatialReference',{}).get('wkid')==4326 and not result.get('exceededTransferLimit');footprints[item['release']]={**item,'features':result['features']}
def inring(point,ring):
    x,y=point;inside=False
    for a,b in zip(ring,ring[1:]+ring[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
    return inside
def near_ring_boundary(point,ring):
    x,y=point
    for a,b in zip(ring,ring[1:]+ring[:1]):
        dx=b[0]-a[0];dy=b[1]-a[1];size=math.hypot(dx,dy)
        if size and min(a[0],b[0])-1e-10<=x<=max(a[0],b[0])+1e-10 and min(a[1],b[1])-1e-10<=y<=max(a[1],b[1])+1e-10 and abs(dx*(y-a[1])-dy*(x-a[0]))/size<1e-10:return True
    return False
def finish(r,attributes):
    date=datetime.datetime.fromtimestamp(attributes['SRC_DATE2']/1000,datetime.timezone.utc).date().isoformat();r['verified_source']={'date':date,'source':attributes.get('SRC_DESC'),'provider':attributes.get('NICE_DESC'),'resolution_m':attributes.get('SAMP_RES'),'accuracy_m':attributes.get('SRC_ACC')}
    if date!=r['date'] or attributes.get('SRC_DESC')!=r['source']['source']:r.update(status='rejected_wrong_source_footprint');return r
    panel=ROOT/r['evidence_panel'];assert hashlib.sha256(panel.read_bytes()).hexdigest()==r['evidence_panel_sha256'],'Panel hash changed'
    if r.get('footprint_point_crosscheck_expected'):
        expected=r['footprint_point_crosscheck_expected'];assert expected['SRC_DATE2']==attributes['SRC_DATE2'] and expected['SRC_DESC']==attributes['SRC_DESC'],'Footprint geometry and point-query date/sensor differ';r['footprint_point_crosscheck_passed']=True
    r.update(status='verified_visual_position_and_exact_endpoint_source');return r
def verify(row):
    r=dict(row);lon,lat=r['p'];rad=6378137;scale=math.cos(math.radians(lat));off=r['offset_m'];x=rad*math.radians(lon)+r['v'][0]*off/scale;y=rad*math.asinh(math.tan(math.radians(lat)))+r['v'][1]*off/scale;point=[math.degrees(x/rad),math.degrees(math.atan(math.sinh(y/rad)))];r['corrected_coordinate']=point
    item=catalogue.get(r['release'])
    if item is None:r.update(status='pending_missing_edition_catalogue');return r
    footprint=footprints.get(r['release'])
    if footprint:
        covers=[(j,f) for j,f in enumerate(footprint['features']) if sum(inring(point,ring) for ring in f['geometry']['rings'])%2==1]
        boundary=any(near_ring_boundary(point,ring) for f in footprint['features'] for ring in f['geometry']['rings'])
        if len(covers)==1 and not boundary:
            index,feature=covers[0]
            if args.point_crosscheck_step and r['display_index']%args.point_crosscheck_step==0:r['footprint_point_crosscheck_expected']=feature['attributes']
            else:
                try:
                    r.update(metadata_verification_method='official_footprint_geometry_intersection_at_exact_endpoint',metadata_url=footprint['url'],metadata_sha256=footprint['sha256'],metadata_cache=footprint['cache'],footprint_feature_index=index)
                    return finish(r,feature['attributes'])
                except Exception as e:r.update(status='pending_endpoint_metadata_transport_or_evidence_error',detail=str(e));return r
    params={'f':'json','where':'1=1','outFields':'SRC_DATE2,NICE_DESC,SRC_DESC,SAMP_RES,SRC_ACC','geometry':json.dumps({'spatialReference':{'wkid':4326},'x':point[0],'y':point[1]}),'geometryType':'esriGeometryPoint','returnGeometry':'false','spatialRel':'esriSpatialRelIntersects'}
    url=item['metadataLayerUrl']+'/6/query?'+urllib.parse.urlencode(params);key=hashlib.sha256(url.encode()).hexdigest()[:16];cache=QA/f'endpoint-metadata/{r["profile_id"]}-{r["capture"]}-{key}.json';r['metadata_url']=url
    try:
        if cache.exists():data=cache.read_bytes()
        else:
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(url,timeout=30) as response:data=response.read()
                    parsed=json.loads(data);assert 'features' in parsed,parsed;break
                except Exception:
                    if attempt==2:raise
            cache.parent.mkdir(parents=True,exist_ok=True);cache.write_bytes(data)
        result=json.loads(data);features=result.get('features',[])
        r['metadata_sha256']=hashlib.sha256(data).hexdigest();r['metadata_cache']=str(cache.relative_to(ROOT))
        if len(features)!=1:r.update(status='pending_ambiguous_or_missing_source_footprint',feature_count=len(features));return r
        r['metadata_verification_method']='official_point_query_at_exact_endpoint';return finish(r,features[0]['attributes'])
    except Exception as e:r.update(status='pending_endpoint_metadata_transport_or_evidence_error',detail=str(e));return r
results=[]
def save():
    counts={}
    for r in results+pending:counts[r.get('status','pending_visual_ambiguity')]=counts.get(r.get('status','pending_visual_ambiguity'),0)+1
    method='Official footprint polygons intersected with each exact corrected endpoint; individual point queries for ambiguous/boundary cases and systematic crosschecks. Two workers.' if args.footprints else 'Official metadata query at each exact corrected longitude/latitude endpoint; cached byte hash retained. Two workers.'
    payload={'group':args.group,'date':'2026-11-05','field_validated':False,'input_decisions_sha256':hashlib.sha256(input_path.read_bytes()).hexdigest(),'counts':counts,'operational_interpretation_tolerance_m':8,'source_verification_method':method,'limitations':['Visual interpretation tolerance does not imply physical/certified geographic accuracy.','No tide, wave, beach-slope or inter-year registration correction is certified.','A transport error is pending, not evidence that a photo/date is absent.'],'readings':results,'pending':pending}
    dest.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for i,result in enumerate(pool.map(verify,rows)):
        results.append(result)
        if i%10==0:save();print(f'{args.group}: endpoint {i+1}/{len(rows)}; {result["status"]}',flush=True)
save();print('Completed',args.group,len(results),'reviewed plus',len(pending),'pending',flush=True)
