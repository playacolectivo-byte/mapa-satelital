"""User-authorized exploratory temporal estimates, explicitly separate from observations.
Run build-reference-2010.py first. No extrapolation, spatial filling or invented photographs.
"""
import json,collections,statistics,hashlib,math,os
from pathlib import Path
from pyproj import Transformer
ROOT=Path(__file__).resolve().parents[1];R=ROOT/'public/data/shorelines';OUT=R/'reference-2010'
A=Path(os.environ.get('MAP_RESEARCH_ROOT',str(ROOT/'work')))
def load(p):return json.loads(p.read_text())
def dump(p,d):p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
T=Transformer.from_crs(4326,6372,always_xy=True);U=Transformer.from_crs(6372,4326,always_xy=True)
refs={f['properties']['profile_id']:f for f in load(OUT/'2010.geojson')['features']}
profiles={p['id']:p for p in load(A/'investigacion_multitemporal/profiles_reference.json')['profiles']}
anchors=collections.defaultdict(dict)
for pid,f in refs.items():
 p=f['properties'];anchors[pid][2010]=dict(year=2010,position_m=p['before_raw_position_m'],point=f['geometry']['coordinates'][0],capture_dates=[p['capture_dates'][0]],source_urls=[p['source_urls'][0]],sensor=p['sensor'],source=p['source_observations'][0])
for year in [2011,2012]:
 for f in load(OUT/f'{year}.geojson')['features']:
  p=f['properties'];anchors[p['profile_id']][year]=dict(year=year,position_m=p['after_raw_position_m'],point=f['geometry']['coordinates'][1],capture_dates=[p['capture_dates'][1]],source_urls=[p['source_urls'][1]],sensor=p['sensor'],source=p['source_observations'][1])
rejections=collections.Counter()
for f in load(R/'posiciones-anuales.geojson')['features']:
 p=f['properties'];pid=p['profile_id'];year=p['year']
 if pid not in refs:continue
 if p.get('context_review') or p.get('reference_position_only') or p.get('estimated') or p.get('spatial_estimate'):rejections['context_or_estimated']+=1;continue
 base=refs[pid]['properties']['source_observations'][0]
 if p.get('normal_water_sign')!=base['normal_water_sign']:rejections['orientation']+=1;continue
 r=profiles[pid];x,y=T.transform(*f['geometry']['coordinates']);rx,ry=T.transform(r['reference_lon'],r['reference_lat']);nx,ny=r['normal_projected_xy'];cross=abs((x-rx)*ny-(y-ry)*nx)
 if cross>.15:rejections['off_axis']+=1;continue
 position=((x-rx)*nx+(y-ry)*ny)*p['normal_water_sign']
 anchors[pid][year]=dict(year=year,position_m=position,point=f['geometry']['coordinates'],capture_dates=p.get('capture_dates',[]),source_urls=p.get('refs',[]),sensor='Sentinel-2 C1 L2A · agregado anual',source=p,perpendicular_residual_m=cross)
# Omit each interior annual anchor in turn. This is an algorithm diagnostic,
# not a physical confidence interval or a validation of the long historical gap.
residuals=[]
for pid,ys in anchors.items():
 years=sorted(ys)
 for i,year in enumerate(years[1:-1],1):
  a,b=years[i-1],years[i+1];prediction=ys[a]['position_m']+(ys[b]['position_m']-ys[a]['position_m'])*(year-a)/(b-a)
  residuals.append(dict(profile_id=pid,year=year,predicted_m=prediction,held_out_m=ys[year]['position_m'],absolute_error_m=abs(prediction-ys[year]['position_m'])))
errs=sorted(r['absolute_error_m'] for r in residuals);p90=errs[int(.9*(len(errs)-1))];manifest=load(OUT/'manifest.json');audit=[]
for entry in manifest['periods']:
 year=entry['year'];data=load(OUT/f'{year}.geojson');fs=data['features'];existing={f['properties']['profile_id'] for f in fs}
 for pid,ys in sorted(anchors.items()):
  if pid in existing or year==2010:continue
  lower=max((y for y in ys if y<=year),default=None);upper=min((y for y in ys if y>=year),default=None)
  if lower is None or upper is None:continue
  a,b=ys[lower],ys[upper];base=ys[2010];weight=0 if upper==lower else (year-lower)/(upper-lower);position=a['position_m']+(b['position_m']-a['position_m'])*weight;delta=position-base['position_m']
  r=profiles[pid];x,y=T.transform(r['reference_lon'],r['reference_lat']);nx,ny=r['normal_projected_xy'];sign=refs[pid]['properties']['source_observations'][0]['normal_water_sign'];point=list(U.transform(x+nx*position*sign,y+ny*position*sign))
  support=[base,a] if lower==upper else [base,a,b];dates=sorted({d for o in support for d in o['capture_dates']});urls=sorted({u for o in support for u in o['source_urls']});rid=f'model2010-{year}-{pid}'
  p=dict(record_id=rid,profile_id=pid,baseline_year=2010,comparison_start_year=2010,comparison_end_year=year,year=year,delta_m=delta,municipality=r.get('unique_municipality') or ' / '.join(r.get('municipalities',[])),native_resolution_m=30,estimated=True,spatial_estimate=False,experimental_analysis=True,homologation_pending=True,erosion_confirmed=False,direction_unresolved=abs(delta)<=p90,quality='exploratory_temporal_interpolation_OR_cross_sensor_difference_NOT_observed_erosion',capture_dates=dates,source_urls=urls,method_url='/data/shorelines/reference-2010/method.md',method_id='fixed2010-piecewise-linear-same-axis-v1',model_target_year=year,model_bracket_years=[lower,upper],model_weight_after=weight,before_raw_position_m=base['position_m'],after_raw_position_m=position,empirical_holdout_p90_m=p90,total_uncertainty_m=None,n_obs=len(dates),source_support=support,method_summary=f'Estimación exploratoria del proyecto asistida por ChatGPT. Referencia fija observada en 2010, mismo eje y orientación. Posición estimada de {year} = posición de {lower} + {weight:.10f} × (posición de {upper} − posición de {lower}); cambio acumulado = posición estimada − posición de 2010. '+('El extremo anual tiene apoyo satelital, pero la diferencia entre sensores no está homologada; por eso sigue siendo una estimación.' if lower==upper else 'Interpolación temporal entre apoyos: no es una observación del año intermedio ni reproduce tormentas o fluctuaciones desconocidas.')+' No se extrapola después del último apoyo ni se copian perfiles vecinos.',uncertainty_notes=f'Modelo exploratorio, no medición de erosión ni historia anual comprobada. Incluye Landsat TOA30m y Sentinel SR10m sin homologación radiométrica/geometría independiente ni corrección de marea/oleaje. Error absoluto p90 al retirar apoyos anuales: {p90:.2f}m en {len(errs)} comprobaciones; NO es intervalo de confianza físico ni valida el hueco largo sin observaciones. Error físico total desconocido; una barra roja no demuestra daño persistente.',persistence_screen='modelled_NOT_observed_annual_change',baseline_observation=refs[pid]['properties']['source_observations'][0])
  assert math.isfinite(delta) and lower<=year<=upper and 0<=weight<=1
  fs.append(dict(type='Feature',id=rid,properties=p,geometry=dict(type='LineString',coordinates=[base['point'],point])))
 data['metadata'].update(contains_explicit_temporal_estimates=True,model_id='fixed2010-piecewise-linear-same-axis-v1',no_extrapolation=True,physical_uncertainty_unknown=True);dump(OUT/f'{year}.geojson',data)
 counts=collections.Counter('estimated' if f['properties'].get('estimated') else 'reference' if year==2010 else 'same_sensor_observed_pair' for f in fs)
 entry.update(features=len(fs),path=f'shorelines/map/reference-2010/{year}.json' if fs else None,source=f'reference-2010/{year}.geojson' if fs else None,sha256=sha(OUT/f'{year}.geojson'),counts=dict(counts));audit.append(dict(year=year,**dict(counts)))
manifest.update(model_id='fixed2010-piecewise-linear-same-axis-v1',model_source_sha256=sha(R/'posiciones-anuales.geojson'),has_explicit_estimates=True,model_is_exploratory=True,physical_uncertainty_unknown=True,no_extrapolation=True,holdout_diagnostic=dict(n=len(errs),median_absolute_error_m=statistics.median(errs),p90_absolute_error_m=p90,maximum_absolute_error_m=max(errs)),rejections=dict(rejections));dump(OUT/'manifest.json',manifest)
dump(ROOT/'work/timeline-2010-fix/model-audit.json',dict(periods=audit,holdout=manifest['holdout_diagnostic'],withheld_anchor_residuals=residuals,rejections=dict(rejections)))
print(json.dumps(dict(periods=audit,diagnostic=manifest['holdout_diagnostic'])))
