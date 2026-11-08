"""Derived view partitions; never write into the received scientific assets."""
from pathlib import Path
import json,gzip,hashlib,unicodedata,copy,heapq,math
from shapely.geometry import shape,box,mapping,Point,LineString
from shapely.ops import transform
ROOT=Path(__file__).resolve().parents[1];PUB=ROOT/'public/data';OUT=PUB/'municipalities'
assets=json.loads((ROOT/'lib/generated/data-assets.json').read_text())['assets']
def read(name):
 p=PUB/name
 if not p.exists():p=ROOT/'public'/assets[name]['url'].lstrip('/')
 b=p.read_bytes();return json.loads(gzip.decompress(b) if p.suffix=='.gz' else b)
def slug(s):return ''.join(c for c in unicodedata.normalize('NFKD',s.lower()) if not unicodedata.combining(c)).replace(' ','-')
def encode(d):return (json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n').encode()
def write(folder,name,d):
 b=encode(d);sha=hashlib.sha256(b).hexdigest();p=folder/(name+'.json');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b);p.with_suffix('.json.gz').write_bytes(gzip.compress(b,mtime=0))
 return {'url':'/data/municipalities/'+str(p.relative_to(OUT)), 'gzip_url':'/data/municipalities/'+str(p.relative_to(OUT))+'.gz','sha256':sha,'bytes':len(b)}
# Road half-kilometres follow received road polylines, never a straight line
# across houses or the sea. Disconnected/ambiguous intervals remain absent.
roads=read('road-kilometres.geojson');network=json.loads((ROOT/'work/2026-10-28-kilometraje/red_vial-carreteras-response.json').read_text())['features']
project=lambda x,y,z=None:(x*103700.0,y*111320.0)
road_results=[]
for f in roads['features']:
 p=f['properties'];road_results.append({'id':p['source_feature_id'],'road':p['road_name'],'km':p['km'],'coordinate':f['geometry']['coordinates'],'kind':'official','sources':[p['source_feature_id']]})
for name in sorted({x['road'] for x in road_results}):
 posts=sorted((x for x in road_results if x['road']==name),key=lambda x:x['km']);edges=[];adj={}
 for f in network:
  p=f['properties']
  if p.get('nombre')!=name:continue
  for j,coords in enumerate(f['geometry']['coordinates']):
   line=LineString(coords);metric=transform(project,line);a=tuple(round(c,7) for c in coords[0]);b=tuple(round(c,7) for c in coords[-1]);i=len(edges);edges.append((a,b,line,metric));adj.setdefault(a,[]).append((b,metric.length,i,False));adj.setdefault(b,[]).append((a,metric.length,i,True))
 for a,b in zip(posts,posts[1:]):
  if b['km']-a['km']!=1:continue
  def snap(post):
   pt=Point(project(*post['coordinate']));found=[(e[3].distance(pt),i,e[3].project(pt)) for i,e in enumerate(edges)]
   return min(found) if found else None
  sa,sb=snap(a),snap(b)
  if not sa or not sb or max(sa[0],sb[0])>40:continue
  ai,bi=sa[1],sb[1];ea,eb=edges[ai],edges[bi];route=None
  if ai==bi:
   length=abs(sb[2]-sa[2]);route=[(ai,sa[2],sb[2])]
  else:
   queue=[]
   for node,offset in [(ea[0],0),(ea[1],ea[3].length)]:heapq.heappush(queue,(abs(sa[2]-offset),node,[(ai,sa[2],offset)]))
   seen=set();length=0
   while queue:
    cost,node,parts=heapq.heappop(queue)
    if node in seen or cost>1600:continue
    seen.add(node)
    if node in [eb[0],eb[1]]:
     offset=0 if node==eb[0] else eb[3].length;route=parts+[(bi,offset,sb[2])];length=cost+abs(sb[2]-offset);break
    for nxt,dist,i,rev in adj.get(node,[]):
     if nxt not in seen:heapq.heappush(queue,(cost+dist,nxt,parts+[(i,dist if rev else 0,0 if rev else dist)]))
  if not route or not 650<=length<=1450:continue
  remaining=length/2;coordinate=None
  for i,start,end in route:
   distance=abs(end-start)
   if remaining<=distance:
    e=edges[i];metric=e[3].interpolate(start+(1 if end>=start else -1)*remaining);coordinate=[metric.x/103700,metric.y/111320];break
   remaining-=distance
  if coordinate:road_results.append({'id':a['id']+'-half','road':name,'km':a['km']+.5,'coordinate':coordinate,'kind':'interpolated','sources':[a['id'],b['id']],'method':'half of received road-network distance between consecutive numbered posts'})
model=read('shorelines/scenario/model.json');photos=read('shorelines/photo-alignment/revised-data.json');original_photo_sha=hashlib.sha256((PUB/'shorelines/photo-alignment/revised-data.json').read_bytes()).hexdigest()
visual=read('shorelines/photo-alignment/revised-visual-review.json');manual=read('shorelines/photo-alignment/manual-digitization-20261103.json');assert visual['data_sha256']==manual['data_sha256']==original_photo_sha
exclude={(e['profile_id'],e['capture']):e for e in visual['exclusions']};corrections={(e['profile_id'],e['capture']):e for e in manual['corrections']}
for t in photos['targets']:
 for r in t['readings']:
  key=(t['id'],r['capture'])
  if key in exclude:
   assert r['offset_m']==exclude[key]['original_offset_m'];r['accepted']=False;r['reasons']=list(set(r['reasons']+['manual_visual_discrepancy']))
  if key in corrections:
   c=corrections[key];assert r['offset_m']==c['original_offset_m'] and r['accepted']==c['original_accepted'];r.update(offset_m=c['offset_m'],accepted=True,reasons=[],manual_review={'id':manual['method'],'source':c['source'],'uncertainty_m':c['manual_uncertainty_m']})
catalogue=json.loads((ROOT/'lib/generated/municipal-photo-refined-catalogue.json').read_text());overview=[];reports=[]
pilot=read('shorelines/photo-alignment/manual-progreso-oeste-20261105.json')
assert pilot['data_sha256']==original_photo_sha
pilot_changes={(c['profile_id'],c['capture']):c for c in pilot['corrections']}
for t in photos['targets']:
 for r in t['readings']:
  c=pilot_changes.get((t['id'],r['capture']))
  if c:
   assert r['offset_m']==c['original_offset_m'] and r['accepted']==c['original_accepted']
   r.update(offset_m=c['offset_m'],accepted=True,reasons=[],manual_review={'id':pilot['method'],'source':c['source'],'uncertainty_m':c['manual_uncertainty_m']})
 if t['id'] in pilot['profile_ids']:
  t['review_policy']={k:pilot[k] for k in ['method','reference_capture','first_year','last_year','reviewed_releases']}
guides=read('shorelines/photo-alignment/user-guides-2011-20261105.json')
assert guides['data_sha256']==original_photo_sha
guide_changes={(c['profile_id'],c['capture']):c for c in guides['corrections']}
for t in photos['targets']:
 for r in t['readings']:
  c=guide_changes.get((t['id'],r['capture']))
  if c:
   assert r['offset_m']==c['original_offset_m'] and r['accepted']==c['original_accepted']
   r.update(offset_m=c['offset_m'],accepted=True,reasons=[],manual_review={'id':guides['method'],'source':c['source'],'uncertainty_m':c['manual_uncertainty_m']})
   t['fixed_reference']={'capture':c['capture'],'method':guides['method'],'source':c['source'],'verified_release':next(s['release'] for s in guides['sources'] if s['id']==c['source'])}
for review_file in ['manual-progreso-full-20261105.json','manual-hunucma-20261105.json','manual-dzemul-20261105.json']:
 review=read('shorelines/photo-alignment/'+review_file)
 assert review['status']=='independently_reviewed' and review['data_sha256']==original_photo_sha
 changes={(c['profile_id'],c['capture']):c for c in review['corrections']};refs={r['profile_id']:r for r in review['reference_captures']};gaps={r['profile_id']:r for r in review['reference_gaps']};sources={s['id']:s for s in review['sources']}
 approved=[{'profile_id':c['profile_id'],'capture':c['capture'],'releases':[sources[c['source']]['release']]} for c in review['corrections']]+review.get('reviewed_readings',[])
 method_url='/data/shorelines/photo-alignment/municipal-review-20261105-method.md'
 assert not set(refs).intersection(gaps)
 for t in photos['targets']:
  if t['id'] not in refs and t['id'] not in gaps:continue
  for r in t['readings']:
   c=changes.get((t['id'],r['capture']))
   if c:
    assert r['offset_m']==c['original_offset_m'] and r['accepted']==c['original_accepted']
    r.update(offset_m=c['offset_m'],accepted=True,reasons=[],manual_review={'id':review['method'],'source':c['source'],'uncertainty_m':c['manual_uncertainty_m']})
   checked=next((x for x in review.get('reviewed_readings',[]) if x['profile_id']==t['id'] and x['capture']==r['capture']),None)
   if checked:
    assert 'offset_m' not in checked or checked['offset_m']==r['offset_m']
    if t['id'] not in refs or refs[t['id']]['capture']!=r['capture']:r['manual_review']={'id':review['method'],'source':checked.get('source','reviewed-reading:'+t['id']+':'+str(r['capture'])),'uncertainty_m':checked.get('manual_uncertainty_m',8)}
   excluded=[x for x in review['rejected_readings'] if x['profile_id']==t['id'] and x['capture']==r['capture']]
   if excluded:
    releases=[v for v in r['releases'] if not any('releases' not in x or v in x['releases'] for x in excluded)]
    if releases:r['releases']=releases
    else:r['accepted']=False;r['reasons']=list(dict.fromkeys(r['reasons']+[x['reason'] for x in excluded]))
  captures=[{'capture':r['capture'],'releases':r['releases']} for r in approved if r['profile_id']==t['id']]
  t['review_policy']={'method':review['method'],'reference_capture':refs[t['id']]['capture'] if t['id'] in refs else -1,'first_year':2011,'last_year':2025,'reviewed_releases':list(dict.fromkeys(v for r in captures for v in r['releases'])),'reviewed_captures':captures,'method_url':method_url}
  if t['id'] in gaps:
   t.pop('fixed_reference',None);t['reference_unavailable']={'year':2011,'reason':gaps[t['id']]['reason'],'method':review['method'],'method_url':method_url}
  else:
   ref=refs[t['id']];r=next(r for r in t['readings'] if r['capture']==ref['capture']);s=sources[r['manual_review']['source']]
   assert r['accepted'] and photos['captures'][ref['capture']]['date']==ref['date']
   t['fixed_reference']={'capture':ref['capture'],'method':r['manual_review']['id'],'source':s['id'],'verified_release':s['release'],'method_url':method_url}
refinement_path=PUB/'shorelines/photo-alignment/reference-refinement-20261106.json'
if refinement_path.exists():
 refinement=json.loads(refinement_path.read_text(encoding='utf-8'))
 assert refinement['status']=='independently_reviewed' and refinement['data_sha256']==original_photo_sha and refinement['reference_year']==2011
 changes={c['profile_id']:c for c in refinement['corrections']};sources={s['id']:s for s in refinement['sources']}
 for t in photos['targets']:
  c=changes.get(t['id'])
  if not c:continue
  r=next(r for r in t['readings'] if r['capture']==c['capture']);source=sources[c['source']]
  assert r['offset_m']==c['original_offset_m'] and r['accepted']==c['original_accepted']
  assert photos['captures'][c['capture']]['date']==c['date']==source['capture_date'] and c['date'].startswith('2011-') and source['release'] in r['releases']
  assert not t.get('fixed_reference') or t['fixed_reference']['capture']==c['capture']
  r.update(offset_m=c['offset_m'],accepted=True,reasons=[],manual_review={'id':refinement['method'],'source':source['id'],'uncertainty_m':c['manual_uncertainty_m']})
  t.pop('reference_unavailable',None)
  method_url='/data/shorelines/photo-alignment/reference-refinement-20261106-method.md'
  t['fixed_reference']={'capture':c['capture'],'method':refinement['method'],'source':source['id'],'verified_release':source['release'],'method_url':method_url}
  captures=[r for r in t['review_policy']['reviewed_captures'] if r['capture']!=c['capture']]+[{'capture':c['capture'],'releases':[source['release']]}]
  t['review_policy'].update(method=refinement['method'],reference_capture=c['capture'],reviewed_captures=captures,reviewed_releases=list(dict.fromkeys(v for r in captures for v in r['releases'])),method_url=method_url)
 targets_by_id={t['id']:t for t in photos['targets']}
 for gap in refinement.get('uninterpretable_references',[]):
  t=targets_by_id[gap['profile_id']];r=next(r for r in t['readings'] if r['capture']==gap['capture'])
  assert r['offset_m']==gap['original_offset_m'] and r['accepted']==gap['original_accepted'] and photos['captures'][gap['capture']]['date'].startswith('2011-')
  t.pop('fixed_reference',None)
  method_url='/data/shorelines/photo-alignment/reference-refinement-20261106-method.md'
  t['reference_unavailable']={'year':2011,'reason':gap['reason'],'method':refinement['method'],'method_url':method_url}
  captures=[r for r in t['review_policy']['reviewed_captures'] if r['capture']!=gap['capture']]
  t['review_policy'].update(method=refinement['method'],reference_capture=-1,reviewed_captures=captures,reviewed_releases=list(dict.fromkeys(v for r in captures for v in r['releases'])),method_url=method_url)
# Geometry-bearing datasets are partitioned ahead of time, not after a global download.
names=['road-kilometres.geojson','problems/s34-inventory.geojson','problems/structures-yucatan.geojson','problems/structure-outlines.geojson','problems/geotube-historical-axes.geojson','problems/disturbed-mangrove-2020.geojson','context.geojson','localities.geojson','coast.geojson','mangrove.geojson','wetlands.geojson','water.geojson']
names+=sorted(k for k in assets if k.startswith('problems/gmw/map/years/') and k.endswith('.geojson'))
collections={k:read(k) for k in names}
config=read('config.json');places=read('coastal-places.json')
neighbours=json.loads((ROOT/'lib/generated/municipal-neighbours.json').read_text(encoding='utf-8'))
for view in sorted(catalogue['coastal_views'],key=lambda v:v['bounds'][0]):
 name=view['name'];key=slug(name);folder=OUT/key;bounds=view['bounds'];nav=[bounds[0]-.012,bounds[1]-.012,bounds[2]+.012,bounds[3]+.012];window=box(*nav)
 info={'name':name,'slug':key,'bounds':bounds,'navigation_bounds':nav,'coordinates':view['coordinates']};overview.append(info);index={'municipality':info,'assets':{},'original_photo_sha256':original_photo_sha,'reviews_applied':True}
 targets=[t for t in model['targets'] if t['m']==name];ids={t['id'] for t in targets};source_ids=sorted({i for t in targets for row in t['support'] for i in row});remap={old:new for new,old in enumerate(source_ids)}
 subset={**model,'targets':[{**t,'support':[[remap[i] for i in row] for row in t['support']]} for t in targets],'sources':[model['sources'][i] for i in source_ids],'anchors':[[row[i] for i in source_ids] for row in model['anchors']],'view_scope':name}
 index['model']=write(folder,'scenario',subset);index['photos']=write(folder,'photos',{**photos,'targets':[t for t in photos['targets'] if t['id'] in ids],'view_scope':name})
 counts={}
 for path,collection in collections.items():
  selected=[]
  for f in collection['features']:
   if not f.get('geometry'):continue
   g=shape(f['geometry'])
   if not g.is_empty and g.intersects(window):
    # Published measurement axes retain exact source geometry and attributes.
    if path=='problems/s34-inventory.geojson' or 'Point' in g.geom_type:selected.append(f)
    else:
     clipped=g.intersection(window)
     if clipped.geom_type!='GeometryCollection' and not clipped.is_empty:selected.append({**f,'geometry':mapping(clipped)})
  index['assets'][path]=write(folder,'layers/'+path,{**collection,'features':selected});counts[path]=len(selected)
 local_places=[p for p in places['places'] if p.get('municipality')==name]
 index['assets']['config.json']=write(folder,'config',{**config,'focus_bounds':bounds,'operational_bounds':bounds,'overview_bounds':bounds,'navigation_bounds':nav,'places':local_places,'municipality_scope':name,**({'neighbour_places':neighbours[name]} if name in neighbours else {})})
 local_roads=[r for r in road_results if window.covers(Point(r['coordinate']))]
 index['road_search']=write(folder,'road-search',{'version':1,'records':local_roads})
 (folder/'index.json').write_bytes(encode(index));reports.append({'municipality':name,'profiles':len(targets),'beach_profiles':sum(t['type'].startswith('Playa') for t in targets),'model_bytes':index['model']['bytes'],'photo_bytes':index['photos']['bytes'],'layers':counts,'road_search_results':len(local_roads)})
(OUT/'overview.json').write_bytes(encode({'version':1,'municipalities':overview}))
(ROOT/'lib/generated/municipality-pages.json').write_bytes(encode(overview))
(OUT/'partition-report.json').write_bytes(encode({'original_model_sha256':photos['model_sha256'],'original_photo_sha256':original_photo_sha,'municipalities':reports,'purpose':'view windows, not legal municipal/property delimitations; original source assets unchanged'}))
print(json.dumps({'municipalities':len(overview),'profiles':sum(r['profiles'] for r in reports),'road_results':len(road_results),'half_kilometres':sum(r['kind']=='interpolated' for r in road_results),'generated_folder':str(OUT)},ensure_ascii=False))
