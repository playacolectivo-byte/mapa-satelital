"""Verify the provider identity at every newly interpreted intersection."""
from pathlib import Path
import argparse, concurrent.futures, datetime, hashlib, json, math, urllib.parse, urllib.request
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--qa-folder',default='work/shoreline-reference-refinement-20261105');args=parser.parse_args()
QA=ROOT/args.qa_folder
path=ROOT/'public/data/shorelines/photo-alignment/manual-progreso-oeste-20261105.json'
review=json.loads(path.read_text(encoding='utf-8'))
model=json.loads((ROOT/'public/data/shorelines/scenario/model.json').read_text())
targets={t['id']:t for t in model['targets']}
items={i['releaseNum']:i for i in json.loads((ROOT/'public/data/history/esri-local-captures.json').read_text())['items']}
sources={s['id']:s for s in review['sources']}
captures=json.loads((ROOT/'public/data/shorelines/photo-alignment/revised-data.json').read_text())['captures']
def check(c):
    source=sources[c['source']];t=targets[c['profile_id']]
    lon,lat=t['p'];scale=math.cos(math.radians(lat));radius=6378137
    x=radius*math.radians(lon)+t['v'][0]*c['offset_m']/scale
    y=radius*math.asinh(math.tan(math.radians(lat)))+t['v'][1]*c['offset_m']/scale
    coordinate=[math.degrees(x/radius),math.degrees(math.atan(math.sinh(y/radius)))]
    params={'f':'json','where':'1=1','outFields':'SRC_DATE2,NICE_DESC,SRC_DESC,SAMP_RES,SRC_ACC','geometry':json.dumps({'spatialReference':{'wkid':4326},'x':coordinate[0],'y':coordinate[1]}),'geometryType':'esriGeometryPoint','returnGeometry':'false','spatialRel':'esriSpatialRelIntersects'}
    url=items[source['release']]['metadataLayerUrl']+'/6/query?'+urllib.parse.urlencode(params)
    # The URL contains the corrected coordinate. A cache keyed only by profile
    # would silently reuse metadata from the previous, different endpoint.
    key=hashlib.sha256(url.encode()).hexdigest()[:16]
    dest=QA/f'metadata-endpoints/{source["release"]}-{c["profile_id"]}-{key}.json'
    if dest.exists(): data=dest.read_bytes()
    else:
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url,timeout=30) as response:data=response.read()
                break
            except (TimeoutError,urllib.error.URLError):
                if attempt==2:raise
        dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
    result=json.loads(data)
    assert 'error' not in result and len(result['features'])==1,(c['profile_id'],result)
    attributes=result['features'][0]['attributes']
    actual=datetime.datetime.fromtimestamp(attributes['SRC_DATE2']/1000,datetime.timezone.utc).date().isoformat()
    assert actual==c['date'],(c['profile_id'],c['date'],actual)
    original=captures[c['capture']]
    assert attributes['SRC_DESC']==original['source']
    return {'source':source['id'],'coordinate':coordinate,'url':url,'sha256':hashlib.sha256(data).hexdigest(),'date':actual,'sensor':attributes['SRC_DESC']}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:results=list(pool.map(check,review['corrections']))
report={'date':'2026-11-05','checked_intersections':len(results),'status':'passed','source_review_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'checks':results,'scope':'Date and sensor at the corrected endpoint; not physical accuracy validation.'}
(QA/'endpoint-source-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'passed','checked_intersections':len(results)}),flush=True)
