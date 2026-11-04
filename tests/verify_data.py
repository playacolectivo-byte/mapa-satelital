"""Focused Stage B checks; does not repeat the complete Stage A audit."""
from pathlib import Path
import json,hashlib,math,sys
root=Path(__file__).resolve().parent.parent; project=root.parent; data=root/'public/data'
def load(p): return json.loads(p.read_text())
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while b:=f.read(1024*1024):h.update(b)
 return h.hexdigest()
def coords(g):
 c=g.get('coordinates',[])
 def walk(x):
  if len(x)>=2 and isinstance(x[0],(int,float)):
   yield x[0],x[1]
  else:
   for y in x:yield from walk(y)
 yield from walk(c)
config=load(data/'config.json');prep=load(data/'preparation.json')
assert config['dataset_count']==4 and config['theme_count']==5
assert config['overview_bounds']==[-90.4,20.95,-87.25,21.75]
assert config['navigation_bounds']==[-90.55,20.65,-87.15,22.0]
assert config['themes']==['coast','localities','mangrove','wetlands','water']
seen=set()
for name in config['themes']:
 doc=load(data/f'{name}.geojson');assert doc['type']=='FeatureCollection' and doc['features']
 assert len(doc['features'])==prep['datasets'][name]['count']
 assert sha(data/f'{name}.geojson')==prep['datasets'][name]['sha256']
 for f in doc['features']:
  p=f['properties'];assert f['id']==p['record_id'] and f['id'] not in seen;seen.add(f['id'])
  assert p['theme']==name and p['origin']=='OFICIAL' and p['status']=='DERIVADO'
  assert all(math.isfinite(x) and -180<=x<=180 and -90<=y<=90 for x,y in coords(f['geometry']))
classes={f['properties'].get('Clase') for f in load(data/'wetlands.geojson')['features']}
assert classes=={7}
classes={f['properties'].get('Clase') for f in load(data/'water.geojson')['features']}
assert classes=={8}
assert all(f['properties']['source_id']=='S12' for f in load(data/'mangrove.geojson')['features'])
assert {f['properties']['name'] for f in load(data/'localities.geojson')['features']}=={'Chelem','Chuburná','Progreso'}
manifest={x['path']:x['sha256'] for x in load(project/'evidence/download_manifest.json')['files']}
for rel in ['work/originals/linea_costa_2025.zip','work/originals/localidades_progreso.geojson','work/originals/mx_man20gw.zip','work/originals/mx_oc2020gw_http.zip']:
 assert sha(project/rel)==manifest[rel],rel
assert (data/'metadata-evidence.zip').stat().st_size>0
imagery=load(data/'imagery-sources.json')
assert imagery['service']=='Esri World Imagery'
assert len(imagery['verified_points'])==4
assert {p['place'] for p in imagery['verified_points']}=={'Chelem','Chuburná','Progreso','Yucalpetén'}
assert all(2023<=int(p['capture'][:4])<=2025 and p['source']=='Vantor' for p in imagery['verified_points'])
print(f'OK: {len(seen)} elementos trazables; 4 datasets, 5 temas; originales conservados.')
