"""Stage B: reproducible display derivatives, never modifies original datasets."""
from pathlib import Path
import json,hashlib,gzip,datetime,zipfile,argparse
import shapefile
from shapely.geometry import shape,box,mapping
from shapely.ops import transform,unary_union
from pyproj import CRS,Transformer
app=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--originals-root',type=Path,default=app.parent,help='Directory containing work/ and evidence/ from Etapa A, plus work/stage_b/originals/')
project=parser.parse_args().originals_root.resolve()
out=app/'public/data';out.mkdir(parents=True,exist_ok=True)
proof=app/'docs';proof.mkdir(exist_ok=True)
def load(p):return json.loads(p.read_text())
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
to_m=Transformer.from_crs(4326,32616,always_xy=True).transform
to_w=Transformer.from_crs(32616,4326,always_xy=True).transform
itrf_to_wgs=Transformer.from_crs(6365,4326,always_xy=True)
locdoc=load(project/'work/originals/localidades_progreso.geojson')
locs={f['properties']['nom_loc']:transform(itrf_to_wgs.transform,shape(f['geometry'])) for f in locdoc['features'] if f['properties']['nom_loc'] in ['Chelem','Chuburná','Progreso']}
ports=[shape(f['geometry']) for f in load(project/'work/dinamica_riesgos/procivy_puertos.json')['features'] if f['properties']['nombre'] in ['CHUBURNÁ','YUCALPETÉN']]
seed=unary_union(list(locs.values())+ports)
op_m=box(*transform(to_m,seed).buffer(3000).bounds)
op=transform(to_w,op_m);op_bounds=list(op.bounds)
focus=unary_union([locs['Chelem'],locs['Chuburná']]+ports)
focus_bounds=list(transform(to_w,box(*transform(to_m,focus).buffer(1400).bounds)).bounds)
manifest=load(project/'evidence/download_manifest.json')
hashes={x['path']:x['sha256'] for x in manifest['files']}
report={'prepared_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'crs':'EPSG:4326 / RFC7946','itrf2008_to_wgs84':{'operation':itrf_to_wgs.description,'accuracy_m':itrf_to_wgs.accuracy,'note':'Geodetic operation accuracy, not positional accuracy of source dataset.'},'operational_bounds':op_bounds,'focus_bounds':focus_bounds,'operational_method':'UTM16N envelope of official Chelem/Chuburná/Progreso locality polygons and PROCIVY Chuburná/Yucalpetén points, expanded by 3000 m for display context. Extent is an operational choice, not scientific cell limits; partial lagoon and marine coverage. Ports are inputs to extent only, not a published thematic layer.','extent_auxiliary':{'path':'work/dinamica_riesgos/procivy_puertos.json','sha256':digest(project/'work/dinamica_riesgos/procivy_puertos.json')},'datasets':{}}
collections_out={}
def serial(name,features):
 d={'type':'FeatureCollection','features':features};raw=json.dumps(d,ensure_ascii=False,separators=(',',':')).encode();p=out/(name+'.geojson');p.write_bytes(raw);collections_out[name]=d
 return {'count':len(features),'bytes':len(raw),'gzip_bytes':len(gzip.compress(raw)),'sha256':hashlib.sha256(raw).hexdigest()}
def derivative(g,tolerance):
 clipped=transform(to_m,g).intersection(op_m)
 if clipped.is_empty:return None
 simple=clipped.simplify(tolerance,preserve_topology=True)
 if not simple.is_valid:raise ValueError('Invalid display derivative; no automatic repair permitted')
 if simple.geom_type=='GeometryCollection':
  parts=[p for p in simple.geoms if p.geom_type in ['Polygon','MultiPolygon','LineString','MultiLineString']]
  if not parts:return None
  simple=unary_union(parts)
 return transform(to_w,simple)
sources=load(project/'work/sources.json');byid={x['ID']:x for x in sources}
specs=[('coast','S01','linea_costa_2025',None,1),('mangrove','S12','mx_man20gw',5,2),('wetlands','S13','mx_oc2020gw_http',7,2),('water','S13','mx_oc2020gw_http',8,2)]
for name,sid,stem,cls,tolerance in specs:
 archive='work/originals/'+stem+'.zip';sha=hashes[archive]
 if digest(project/archive)!=sha:raise ValueError('Original hash changed: '+archive)
 shp=next((project/'work/extracted'/stem).rglob('*.shp'));reader=shapefile.Reader(str(shp));crs=CRS.from_wkt(shp.with_suffix('.prj').read_text());t=Transformer.from_crs(crs,4326,always_xy=True).transform
 # Index-driven read for the established audit window, plus bbox screening for the expanded display scope.
 back=Transformer.from_crs(4326,crs,always_xy=True).transform
 native_bbox=transform(back,op).bounds
 fs=[];matched=0;cut=0;invalid=0;rows=[]
 for sr in reader.iterShapeRecords(bbox=native_bbox):
  rec=sr.record.as_dict()
  if cls is not None and rec.get('Clase')!=cls:continue
  g=transform(t,shape(sr.shape.__geo_interface__))
  if not g.intersects(op):continue
  matched+=1
  if not g.is_valid:invalid+=1;continue
  geom=derivative(g,tolerance)
  if geom is None or geom.geom_type not in ['Polygon','MultiPolygon','LineString','MultiLineString']:continue
  cut+=int(not op.covers(g));row=sr.record.oid;fid=f'{sid}-{sha[:10]}-{row}';rows.append(row)
  props={'record_id':fid,'source_id':sid,'source_row':row,'source_hash':sha,'theme':name,'status':'DERIVADO','origin':'OFICIAL','name':rec.get('Descrip') or 'Costa de referencia','date':'2020' if sid in ['S12','S13'] else '2023–2025','clipped':not op.covers(g),'simplification_m':tolerance}
  for k in ['OBJECTID','CODIGO','TIPO','SUBTIPO','CAL_POS','fid_1','Clase','Descrip','Fecha']:
   if k in rec:props[k]=rec[k]
  fs.append({'type':'Feature','id':fid,'properties':props,'geometry':mapping(geom)})
 if invalid:raise ValueError('Invalid original selected; review required')
 report['datasets'][name]={'source_id':sid,'original':archive,'sha256_original':sha,'source_crs':crs.to_string(),'display_simplification_m':tolerance,'selected_originals':matched,'clipped_records':cut,'invalid_selected_originals':invalid,'rows':rows,**serial(name,fs)}
fs=[];places=[];sha=hashes['work/originals/localidades_progreso.geojson']
if digest(project/'work/originals/localidades_progreso.geojson')!=sha:raise ValueError('Original locality hash changed')
for f in locdoc['features']:
 if f['properties']['nom_loc'] not in locs:continue
 rec=f['properties'];g=transform(itrf_to_wgs.transform,shape(f['geometry']));geom=derivative(g,1)
 fid='S02-'+rec['cvegeo'];props={'record_id':fid,'source_id':'S02','source_hash':sha,'theme':'localities','status':'DERIVADO','origin':'OFICIAL','name':rec['nom_loc'],'date':'Marco 2025 · Censo 2020','cvegeo':rec['cvegeo'],'population_2020':rec['pob_total'],'clipped':not op.covers(g),'simplification_m':1}
 fs.append({'type':'Feature','id':fid,'properties':props,'geometry':mapping(geom)})
 places.append({'id':fid,'name':rec['nom_loc'],'coordinates':[float(rec['longitud']),float(rec['latitud'])],'bounds':list(g.bounds),'population':rec['pob_total'],'cvegeo':rec['cvegeo']})
report['datasets']['localities']={'source_id':'S02','original':'work/originals/localidades_progreso.geojson','sha256_original':sha,'source_crs':'EPSG:6365','display_simplification_m':1,**serial('localities',fs)}
# Official state geometry supplies regional context, registered separately as S50, never counted among core themes.
states=[];state_proof=[]
for item in load(project/'work/stage_b/originals/state_manifest.json'):
 original=project/item['path']
 if digest(original)!=item['sha256'] or original.stat().st_size!=item['bytes']:raise ValueError('Context original changed')
 f=load(original)['features'][0]
 g=transform(itrf_to_wgs.transform,shape(f['geometry']));valid=g.is_valid
 if not valid:raise ValueError('Invalid context geometry')
 simplified=transform(to_w,transform(to_m,g).simplify(20,preserve_topology=True))
 states.append({'type':'Feature','id':'S50-'+f['properties']['cvegeo'],'properties':{'name':f['properties']['nomgeo'],'source_id':'S50','status':'DERIVADO','origin':'OFICIAL'},'geometry':mapping(simplified)})
 state_proof.append({'state':f['properties']['nomgeo'],'valid':valid,'bounds':list(g.bounds)})
report['datasets']['context']={'source_id':'S50','source_crs':'EPSG:6365','display_simplification_m':20,'originals':load(project/'work/stage_b/originals/state_manifest.json'),'states':state_proof,**serial('context',states)}
# Geometric relations use original locality polygons, display selections only; neither area nor legal conclusion.
relations={p['id']:{name:sum(shape(f['geometry']).intersects(locs[p['name']]) for f in d['features']) for name,d in collections_out.items() if name in ['coast','mangrove','wetlands','water']} for p in places}
for f in collections_out['localities']['features']:f['properties']['relations']=relations[f['id']]
report['datasets']['localities'].update(serial('localities',collections_out['localities']['features']))
config={'focus_bounds':focus_bounds,'operational_bounds':op_bounds,'overview_bounds':[-90.4,20.95,-87.25,21.75],'navigation_bounds':[-90.55,20.65,-87.15,22.0],'places':places,'prepared_on':'2026-09-03','themes':['coast','localities','mangrove','wetlands','water'],'dataset_count':4,'theme_count':5}
(out/'config.json').write_text(json.dumps(config,ensure_ascii=False,indent=2))
core_sources=[byid[sid] for sid in ['S01','S02','S12','S13']]
(out/'sources.json').write_text(json.dumps(core_sources,ensure_ascii=False,indent=2))
(out/'research-catalogue.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2))
(out/'preparation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
(proof/'DATA_PREPARATION.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
with zipfile.ZipFile(out/'metadata-evidence.zip','w',compression=zipfile.ZIP_DEFLATED) as z:
 for folder in ['metadata','conditions']:
  for p in sorted((project/'inputs'/folder).rglob('*')):
   if p.is_file():z.write(p,p.relative_to(project/'inputs'))
print(json.dumps({k:{x:v[x] for x in ['count','bytes','gzip_bytes']} for k,v in report['datasets'].items()},ensure_ascii=False))
