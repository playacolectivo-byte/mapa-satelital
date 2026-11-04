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
# Geometry-bearing datasets are partitioned ahead of time, not after a global download.
names=['road-kilometres.geojson','problems/s34-inventory.geojson','problems/structures-yucatan.geojson','problems/structure-outlines.geojson','problems/geotube-historical-axes.geojson','problems/disturbed-mangrove-2020.geojson','context.geojson','localities.geojson','coast.geojson','mangrove.geojson','wetlands.geojson','water.geojson']
names+=sorted(k for k in assets if k.startswith('problems/gmw/map/years/') and k.endswith('.geojson'))
collections={k:read(k) for k in names}
config=read('config.json');places=read('coastal-places.json')
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
 index['assets']['config.json']=write(folder,'config',{**config,'focus_bounds':bounds,'operational_bounds':bounds,'overview_bounds':bounds,'navigation_bounds':nav,'places':local_places,'municipality_scope':name})
 local_roads=[r for r in road_results if window.covers(Point(r['coordinate']))]
 index['road_search']=write(folder,'road-search',{'version':1,'records':local_roads})
 (folder/'index.json').write_bytes(encode(index));reports.append({'municipality':name,'profiles':len(targets),'beach_profiles':sum(t['type'].startswith('Playa') for t in targets),'model_bytes':index['model']['bytes'],'photo_bytes':index['photos']['bytes'],'layers':counts,'road_search_results':len(local_roads)})
(OUT/'overview.json').write_bytes(encode({'version':1,'municipalities':overview}))
(ROOT/'lib/generated/municipality-pages.json').write_bytes(encode(overview))
(OUT/'partition-report.json').write_bytes(encode({'original_model_sha256':photos['model_sha256'],'original_photo_sha256':original_photo_sha,'municipalities':reports,'purpose':'view windows, not legal municipal/property delimitations; original source assets unchanged'}))
print(json.dumps({'municipalities':len(overview),'profiles':sum(r['profiles'] for r in reports),'road_results':len(road_results),'half_kilometres':sum(r['kind']=='interpolated' for r in road_results),'generated_folder':str(OUT)},ensure_ascii=False))
