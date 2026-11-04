"""Explicit fixed-2010 experimental comparisons of independently reproduced C1 observations.
No cross-platform/method pairs, future anchoring, interpolation, or spatial filling.
"""
import json, hashlib, datetime, collections, os
from pathlib import Path
from pyproj import Transformer
ROOT=Path(__file__).resolve().parents[1]
RESEARCH=Path(os.environ.get('MAP_RESEARCH_ROOT',str(ROOT/'work')))
SOURCE=RESEARCH/'base_historica_nativa/capas_ancla_local/observaciones-individuales.json'
QA=RESEARCH/'qa_c1/native-bases-independent.json'
OUT=ROOT/'public/data/shorelines/reference-2010';OUT.mkdir(exist_ok=True)
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def dump(path,value):path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n')
raw=json.loads(SOURCE.read_text());qa=json.loads(QA.read_text())
assert qa['observations_source_sha256']==digest(SOURCE) and qa['status'].startswith('PASS_')
profiles={p['id']:p for p in json.loads((RESEARCH/'investigacion_multitemporal/profiles_reference.json').read_text())['profiles']}
groups=collections.defaultdict(list)
for o in raw:
 if o.get('orientation_inferred') or o.get('estimated') or not o.get('used_in_annual_baseline'):continue
 assert o['normal_water_sign'] in [-1,1]
 groups[o['profile_id'],o['platform'],o['method_family'],o['year']].append(o)
T=Transformer.from_crs(4326,6372,always_xy=True);U=Transformer.from_crs(6372,4326,always_xy=True)
# One fixed, deterministic baseline per profile, shared by every year.
fixed={}
for (pid,platform,method,y),observations in groups.items():
 if y!=2010:continue
 for o in observations:
  rank=(o.get('threshold_spread_m',float('inf')),o['capture'],o['scene_id'])
  if pid not in fixed or rank<fixed[pid][0]:fixed[pid]=(rank,o)
entries=[]
for year in range(2010,2027):
 choices=collections.defaultdict(list)
 for (pid,platform,method,y),base in groups.items():
  if y!=2010:continue
  for a in base:
   if a is not fixed[pid][1]:continue
   for b in groups.get((pid,platform,method,year),[]):
    da=datetime.date.fromisoformat(a['capture'][:10]);db=datetime.date.fromisoformat(b['capture'][:10])
    gap=abs((da.replace(year=2000)-db.replace(year=2000)).days);season=min(gap,366-gap)
    if season>45 or a['normal_water_sign']!=b['normal_water_sign']:continue
    choices[pid].append(((season,a['scene_id'],b['scene_id']),a,b))
 fs=[]
 for pid,candidates in sorted(choices.items()):
  rank,a,b=min(candidates,key=lambda c:c[0]);profile=profiles[pid];x,y=T.transform(profile['reference_lon'],profile['reference_lat']);nx,ny=profile['normal_projected_xy']
  coords=[list(U.transform(x+nx*o['position_water_oriented_m']*o['normal_water_sign'],y+ny*o['position_water_oriented_m']*o['normal_water_sign'])) for o in (a,b)]
  delta=b['position_water_oriented_m']-a['position_water_oriented_m'];rid=f'reference-2010-{year}-{pid}'
  assert abs((b['year']-a['year'])-(year-2010))==0
  p=dict(record_id=rid,profile_id=pid,baseline_year=2010,comparison_start_year=2010,comparison_end_year=year,year=year,delta_m=delta,municipality=profile.get('unique_municipality') or ' / '.join(profile.get('municipalities',[])),native_resolution_m=30,sensor=a['platform']+' · C1 TOA',experimental_analysis=True,homologation_pending=True,erosion_confirmed=False,estimated=False,spatial_estimate=False,quality='experimental_fixed_2010_same_platform_C1',capture_dates=[a['capture'],b['capture']],source_urls=[a['source_url'],b['source_url']],method_url='/data/shorelines/reference-2010/method.md',method_id=a['method_family'],date_before=a['capture'][:10],date_after=b['capture'][:10],before_raw_position_m=a['position_water_oriented_m'],after_raw_position_m=b['position_water_oriented_m'],seasonal_day_difference=rank[0],source_observations=[a,b],native_QA_source_sha256=digest(SOURCE),method_summary='Comparación experimental asistida por ChatGPT. Cambio acumulado = posición sin redondear del año elegido menos posición de 2010, sobre el mismo perfil, plataforma Landsat C1, método y orientación marina. Pareja seleccionada por proximidad estacional ≤45 días antes de considerar los metros. Los extremos se reconstruyen en EPSG:6372 desde el eje original. No se suman cambios anuales ni se interpola entre años. No se comparó Landsat C1 con Sentinel o C2.',uncertainty_notes='Borde instantáneo del agua, no pérdida permanente confirmada. Resolución original 30m; registro, marea, oleaje, pendiente y exactitud física total sin resolver. QA numérica previa no equivale a validación de campo ni revisión RGB de cada perfil.',persistence_screen='single_capture_per_year_NO_temporal_persistence_test',n_obs='2010: 1 · '+str(year)+': 1')
  fs.append(dict(type='Feature',id=rid,geometry=dict(type='LineString',coordinates=coords),properties=p))
 target=OUT/f'{year}.geojson';dump(target,dict(type='FeatureCollection',metadata=dict(baseline_year=2010,year=year,partial_coverage=True,experimental=True,source_sha256=digest(SOURCE)),features=fs))
 entries.append(dict(year=year,before=2010,features=len(fs),path=f'shorelines/map/reference-2010/{year}.json' if fs else None,source=f'reference-2010/{year}.geojson' if fs else None,status='experimental_native_C1_same_platform' if fs else 'not_available',sha256=digest(target)))
dump(OUT/'manifest.json',dict(baseline_year=2010,partial_coverage=True,experimental=True,method_url='/data/shorelines/reference-2010/method.md',periods=entries,source_sha256=digest(SOURCE),qa_sha256=digest(QA)))
print([(e['year'],e['features']) for e in entries])
