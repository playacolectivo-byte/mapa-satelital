"""Reproduce visually interpreted intersections from the retained QA panels.

Rows are operator annotations on the unwarped-source sampling panels, not
classifier output. Source accuracy and environmental effects remain unresolved.
"""
from pathlib import Path
import csv, hashlib, json, math
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
QA=ROOT/'work/shoreline-reference-refinement-20261105'
manifest=json.loads((QA/'manifest.json').read_text(encoding='utf-8'))
raw=(ROOT/'public/data/shorelines/photo-alignment/revised-data.json').read_bytes()
original=json.loads(raw)
local=json.loads(raw)
exclusions={(x['profile_id'],x['capture']) for x in json.loads((ROOT/'public/data/shorelines/photo-alignment/revised-visual-review.json').read_text())['exclusions']}
for target in local['targets']:
    for reading in target['readings']:
        if (target['id'],reading['capture']) in exclusions:reading['accepted']=False
targets=manifest['profiles']
# The visible, contiguous water/sand boundary at each yellow centre axis.
# y=240 is the nominal offset zero; two panel pixels represent one metre.
# Broad surf/shallow-water transitions retain an 8 m interpretation tolerance.
rows={
11019:[198,198,201,183,184,156,152,149,136,154,149,192,176,150,149,177,183,196,206,222,260,275],
27946:[218,209,207,192,195,188,185,173,169,167,172,200,187,181,177,193,208,208,218,226,261,279],
18820:[220,219,211,196,205,207,202,186,181,177,179,205,200,183,177,176,184,190,209,233,267,289],
20753:[239,239,233,228,233,234,236,232,231,232,229,241,244,232,228,232,255,270,294,309,316,294],
17825:[239,228,234,229,234,236,234,235,229,228,230,241,246,230,233,239,264,282,293,302,298,282],
25285:[240,240,238,238,238,237,236,235,235,235,235,242,241,238,234,240,260,270,276,150,132,166],
22252:[245,246,246,247,248,248,248,246,240,244,241,253,251,247,243,242,242,241,252,269,298,302],
}
release_date={r:next(i['releaseDateLabel'] for i in json.loads((ROOT/'public/data/history/esri-local-captures.json').read_text())['items'] if i['releaseNum']==r) for r in rows}
prior_bytes=(QA/'prior-review.json').read_bytes()
prior=json.loads(prior_bytes)
review={'version':1,'revision':2,'previous_review_sha256':hashlib.sha256(prior_bytes).hexdigest(),'data_sha256':hashlib.sha256(raw).hexdigest(),'model_sha256':original['model_sha256'],'method':'visible-water-sand-west-progreso-20261105-r2','field_validated':False,'reference_date':'2011-08-01','reference_capture':40,'profile_ids':[t['id'] for t in targets],'first_year':2011,'last_year':2025,'reviewed_releases':list(rows),'source_zoom':17,'interpretation':'Reference refinements guided by the user-marked apparent shoreline and inspected on the retained unwarped 2011 source. No uniform shift, tide, wave or relative-registration correction was applied.','missing_year_policy':'pending_without_model_substitution','sources':[],'corrections':[]}
requested=[6,7,8,9,10,12,14,15,16,17,18,19,20,21,22]
review['reference_refinement']={'requested_ordinals':requested,'preserved_ordinals':[1,2,3,4,5,11,13],'ordinal_origin':'First beach profile assigned to Progreso, west to east; ordinal 1 = SC-258-0-30.','guide':'White shoreline annotation supplied in the conversation; source-image registration uses the unannotated attached captures.','changes':[]}
for n,t in enumerate(targets,1):
    old=next((c for c in prior['corrections'] if c['profile_id']==t['id'] and c['capture']==40),None)
    offset=(240-rows[11019][n-1])/2
    if n in requested:review['reference_refinement']['changes'].append({'ordinal':n,'profile_id':t['id'],'previous_manual_offset_m':old['offset_m'] if old else None,'offset_m':offset})
    elif old:assert offset==old['offset_m']
review['other_date_refinements']=[{'profile_id':'SC-258-0-49','date':'2022-01-24','previous_offset_m':-16,'offset_m':45,'reason':'The wide, connected dry sand beach next to the breakwater was mistaken for submerged colour in the previous interpretation.'}]
csv_rows=[]
z=manifest['zoom'];size=256*2**z
def pixel(p):return np.array([(p[0]+180)/360*size,(1-math.asinh(math.tan(math.radians(p[1])))/math.pi)/2*size])
for release,ys in rows.items():
    panel=Image.open(QA/f'profiles-{release}.png').convert('RGB');pd=ImageDraw.Draw(panel)
    mosaic=Image.open(QA/f'mosaic-{release}.png').convert('RGB');md=ImageDraw.Draw(mosaic)
    vertices=[]
    assert len(ys)==len(targets)
    for i,(t,y) in enumerate(zip(targets,ys)):
        record=next(r for r in next(x for x in local['targets'] if x['id']==t['id'])['readings'] if release in r['releases'])
        capture=original['captures'][record['capture']]
        meta=next(x for x in manifest['metadata'] if x['profile_id']==t['id'] and x['release']==release)
        assert len(meta['attributes'])==1 and meta['attributes'][0]['capture_date']==capture['date']
        assert meta['attributes'][0]['SRC_DESC']==capture['source']
        offset=round((240-y)/2,1)
        scale=156543.03392804097*math.cos(math.radians(t['p'][1]))/2**z
        vertex=pixel(t['p'])+np.array([t['v'][0],-t['v'][1]])*offset/scale-np.array(manifest['origin_pixel'])
        vertices.append(vertex.tolist())
        source_id=f'west-progreso-{release}-{t["id"]}'
        review['sources'].append({'id':source_id,'release':release,'capture_date':capture['date'],'screenshot_sha256':hashlib.sha256((QA/f'profiles-{release}.png').read_bytes()).hexdigest(),'metadata_url':meta['url'],'metadata_sha256':meta['sha256'],'mosaic_pixel':vertex.tolist(),'panel_pixel':[i*72+35.5,y],'source_resolution_m':capture['resolution_m'],'source_accuracy_m':capture['accuracy_m']})
        uncertainty=8 if release in [11019,27946,20753,17825,25285] else 6
        review['corrections'].append({'profile_id':t['id'],'capture':record['capture'],'date':capture['date'],'releases':record['releases'],'original_offset_m':record['offset_m'],'original_accepted':record['accepted'],'offset_m':offset,'manual_uncertainty_m':uncertainty,'source':source_id})
        csv_rows.append({'profile_id':t['id'],'date':capture['date'],'release':release,'previous_offset_m':record['offset_m'],'previous_accepted':record['accepted'],'reviewed_offset_m':offset,'interpretation_tolerance_m':uncertainty})
        pd.line([(i*72+16,y),(i*72+55,y)],fill='#ff3333',width=2)
        pd.ellipse((i*72+32,y-3,i*72+39,y+4),outline='white',width=1)
        md.ellipse((vertex[0]-3,vertex[1]-3,vertex[0]+3,vertex[1]+3),outline='red',width=2)
        md.text((vertex[0]+5,vertex[1]+5),str(t['id'].split('-')[-1]),fill='white',stroke_width=1,stroke_fill='black')
    md.line([tuple(v) for v in vertices],fill='#ff3333',width=2)
    pd.rectangle((0,445,len(targets)*72,470),fill='#172b30');pd.text((8,450),'RED: visually interpreted apparent water/sand intersection. No field validation or tide/registration correction.',fill='white')
    panel.save(QA/f'reviewed-profiles-{release}.png');mosaic.save(QA/f'reviewed-mosaic-{release}.png')
    review.setdefault('evidence',[]).append({'release':release,'publication_date':release_date[release],'panel_sha256':hashlib.sha256((QA/f'reviewed-profiles-{release}.png').read_bytes()).hexdigest(),'mosaic_sha256':hashlib.sha256((QA/f'mosaic-{release}.png').read_bytes()).hexdigest(),'mosaic_vertices':vertices})
dest=ROOT/'public/data/shorelines/photo-alignment/manual-progreso-oeste-20261105.json'
dest.write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
with (QA/'intersections.csv').open('w',encoding='utf-8',newline='') as f:
    w=csv.DictWriter(f,fieldnames=csv_rows[0]);w.writeheader();w.writerows(csv_rows)
print(json.dumps({'profiles':len(targets),'dated_intersections':len(review['corrections']),'file':str(dest)}))
