"""Join pinned manual visual confirmations with verified source endpoint evidence."""
from pathlib import Path
import datetime,hashlib,json,math,urllib.parse
root=Path(__file__).resolve().parents[1];qa=root/'work/hunucma-audit-20261105';raw=(root/'public/data/municipalities/hunucma/photos.json').read_bytes();photos=json.loads(raw);model=json.loads((root/'public/data/municipalities/hunucma/scenario.json').read_text(encoding='utf-8'));modelrows={t['id']:t for t in model['targets']};photorows={t['id']:t for t in photos['targets']};items={i['releaseNum']:i for i in json.loads((root/'public/data/history/esri-local-captures.json').read_text(encoding='utf-8'))['items']}
visual=json.loads((qa/'visual-confirmations.json').read_text(encoding='utf-8'));assert visual['photos_sha256']==hashlib.sha256(raw).hexdigest()
accepted=[];pending=[]
for row in visual['records']:
 target=modelrows[row['profile_id']];reading=next(r for r in photorows[target['id']]['readings'] if row['release'] in r['releases']);capture=photos['captures'][reading['capture']]
 assert reading['capture']==row['capture'] and reading['offset_m']==row['offset_m'] and capture['date']==row['date'];assert hashlib.sha256((root/row['panel_path']).read_bytes()).hexdigest()==row['panel_sha256']
 lon,lat=target['p'];offset=reading['offset_m'];r=6378137;s=math.cos(math.radians(lat));x=r*math.radians(lon)+target['v'][0]*offset/s;y=r*math.asinh(math.tan(math.radians(lat)))+target['v'][1]*offset/s;coordinate=[math.degrees(x/r),math.degrees(math.atan(math.sinh(y/r)))]
 params={'f':'json','where':'1=1','outFields':'SRC_DATE2,NICE_DESC,SRC_DESC,SAMP_RES,SRC_ACC','geometry':json.dumps({'spatialReference':{'wkid':4326},'x':coordinate[0],'y':coordinate[1]}),'geometryType':'esriGeometryPoint','returnGeometry':'false','spatialRel':'esriSpatialRelIntersects'}
 url=items[row['release']]['metadataLayerUrl']+'/6/query?'+urllib.parse.urlencode(params);key=hashlib.sha256(url.encode()).hexdigest();dest=qa/f'later-endpoint-metadata/{row["release"]}-{target["id"]}-{key[:16]}.json'
 if not dest.exists():pending.append({**row,'reason':'source_endpoint_not_yet_verified'});continue
 data=dest.read_bytes();result=json.loads(data)
 if len(result.get('features',[]))!=1:pending.append({**row,'reason':'ambiguous_source_endpoint_metadata'});continue
 attrs=result['features'][0]['attributes'];actual=datetime.datetime.fromtimestamp(attrs['SRC_DATE2']/1000,datetime.timezone.utc).date().isoformat()
 if actual!=capture['date'] or attrs['SRC_DESC']!=capture['source']:pending.append({**row,'reason':'source_endpoint_mismatch','actual_date':actual,'actual_source':attrs['SRC_DESC']});continue
 accepted.append({'profile_id':target['id'],'capture':reading['capture'],'date':capture['date'],'releases':[row['release']],'visual_status':'accepted','offset_m':reading['offset_m'],'manual_uncertainty_m':8,'panel':row['panel_path'],'panel_sha256':row['panel_sha256'],'metadata_url':url,'metadata_sha256':hashlib.sha256(data).hexdigest(),'reviewer':'hunucma_audit'})
overlay_path=root/'public/data/shorelines/photo-alignment/manual-hunucma-20261105.json';overlay=json.loads(overlay_path.read_text(encoding='utf-8'));overlay['reviewed_readings']=accepted
source_report=root/'docs/qa/hunucma-source-endpoints-baseline-20261105.json'
if source_report.exists():
 mismatches=[r for r in json.loads(source_report.read_text(encoding='utf-8'))['records'] if r['status']=='mismatch']
 overlay['rejected_readings']=[{'profile_id':r['profile_id'],'capture':r['capture'],'releases':[r['release']],'original_offset_m':r['offset_m'],'original_accepted':True,'reason':'corrected_endpoint_has_different_source','expected_date':r['date'],'actual_date':r['actual_date'],'expected_source':r['source'],'actual_source':r['actual_source'],'metadata_url':r['url'],'metadata_sha256':r['metadata_sha256']} for r in mismatches]
(qa/'reviewed-readings.json').write_text(json.dumps({'photos_sha256':hashlib.sha256(raw).hexdigest(),'records':accepted},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
temporary=overlay_path.with_suffix('.json.tmp');temporary.write_text(json.dumps(overlay,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');temporary.replace(overlay_path)
(qa/'visual-source-join.json').write_text(json.dumps({'accepted':len(accepted),'pending':pending},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'reviewed_readings':len(accepted),'visually_confirmed_but_source_pending':len(pending)}))
