"""Reproducible integrity, provenance, metric and coverage checks."""
from pathlib import Path
import collections,csv,hashlib,json,math,statistics
from pyproj import Geod
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/dzemul-audit-20261105';review=json.loads((ROOT/'public/data/shorelines/photo-alignment/manual-dzemul-20261105.json').read_text(encoding='utf-8'));manifest=json.loads((QA/'input-manifest.json').read_text(encoding='utf-8'));model={t['id']:t for t in manifest['profiles']};raw=json.loads((ROOT/'public/data/shorelines/photo-alignment/revised-data.json').read_text(encoding='utf-8'));original={(t['id'],r['capture']):r for t in raw['targets']for r in t['readings']};sources={s['id']:s for s in review['sources']};corrections={(r['profile_id'],r['capture']):r for r in review['corrections']};allkeys={(r['profile_id'],r['capture'])for r in manifest['rows']};rejected={(r['profile_id'],r['capture'])for r in review['rejected_readings']};geod=Geod(ellps='WGS84')
assert len(corrections)==len(review['corrections'])==1072
assert set(corrections)|rejected==allkeys and not(set(corrections)&rejected)
assert len(allkeys)==1073 and len(rejected)==1
exclusions=json.loads((ROOT/'public/data/shorelines/photo-alignment/revised-visual-review.json').read_text(encoding='utf-8'))['exclusions'];excluded={(r['profile_id'],r['capture'])for r in exclusions}
assert all(r['original_offset_m']==original[key]['offset_m']and r['original_accepted']==(False if key in excluded else original[key]['accepted'])for key,r in corrections.items())
assert all(sources[r['source']]['metadata_endpoint_verified'] for r in corrections.values())
assert len(review['reference_captures'])==len({r['profile_id']for r in review['reference_captures']})==134
assert all(r['date']=='2011-08-01'and r['capture']==40 for r in review['reference_captures'])
metric_errors=[];large=[];differences=[]
for key,r in corrections.items():
 t=model[r['profile_id']];s=sources[r['source']];source_path=ROOT/s['panel'];assert hashlib.sha256(source_path.read_bytes()).hexdigest()==s['screenshot_sha256']
 assert s['capture_date']==r['date']and s['release']in r['releases']and math.isfinite(r['offset_m'])and r['manual_uncertainty_m']==8
 panel_y=s['panel_pixel'][1]
 if r['date'].startswith('2011'):assert abs(r['offset_m']-(348-panel_y)/2)<1e-9
 else:
  base=corrections[r['profile_id'],40]['offset_m'];assert abs(r['offset_m']-(base+(148-panel_y)/2))<1e-9;assert 48<=panel_y<=248
 distance=geod.inv(*t['p'],*s['coordinate'])[2];metric_errors.append(abs(distance-abs(r['offset_m'])))
 if r['original_offset_m']is not None:
  difference=abs(r['offset_m']-r['original_offset_m']);differences.append(difference)
  if difference>20:large.append({'profile_id':r['profile_id'],'capture':r['capture'],'date':r['date'],'old_accepted':r['original_accepted'],'old_offset_m':r['original_offset_m'],'manual_offset_m':r['offset_m'],'difference_m':difference,'source':r['source']})
assert max(metric_errors)<.5,max(metric_errors)
for t in manifest['tiles']:
 assert'error'not in t
 path=QA/f'tiles/{t["release"]}/17-{t["x"]}-{t["y"]}.jpg';assert hashlib.sha256(path.read_bytes()).hexdigest()==t['sha256']
yearrows=[]
for year in range(2011,2026):
 for profile in model:
  matching=[r for r in corrections.values()if r['profile_id']==profile and int(r['date'][:4])==year]
  yearrows.append({'profile_id':profile,'year':year,'status':'visually_interpreted_photo'if matching else'pending','dates':';'.join(sorted({r['date']for r in matching})),'manual_offset_m':None if not matching else';'.join(str(r['offset_m'])for r in sorted(matching,key=lambda r:(r['date'],r['capture']))),'reason':None if matching else'capture_footprint_seam'if(profile,188)in rejected and year==2019 else'no_dated_photograph_in_received_inventory'})
with(ROOT/'docs/qa/dzemul-year-coverage-20261105.csv').open('w',encoding='utf-8',newline='')as f:
 writer=csv.DictWriter(f,fieldnames=list(yearrows[0]));writer.writeheader();writer.writerows(yearrows)
yearsummary={year:{'readings_proposed':sum(r['date'].startswith(str(year))for r in corrections.values()),'profiles_with_photo_proposal':sum(r['year']==year and r['status']=='visually_interpreted_photo'for r in yearrows),'profiles_pending':sum(r['year']==year and r['status']=='pending'for r in yearrows)}for year in range(2011,2026)}
summary={'date':'2026-11-05','source_scope_key':'Dzemul','profiles':134,'photo_readings_visually_inspected':1073,'photo_readings_proposed':1072,'source_footprint_seams_pending':1,'fixed_2011_references':134,'reference_independent_cross_review':review['independent_review'],'source_tiles':len(manifest['tiles']),'source_tile_hashes_verified':814,'originally_rejected_now_interpretable':sum(not r['original_accepted']for r in corrections.values()),'absolute_offset_adjustment_m':{'non_null_old_offsets':len(differences),'median':statistics.median(differences),'max':max(differences),'over20m':len(large)},'local_metric_vs_WGS84_geodesic_max_difference_m':max(metric_errors),'native_z17_display_ground_pixel_m':{'min':min(156543.03392804097*math.cos(math.radians(t['p'][1]))/2**17 for t in model.values()),'max':max(156543.03392804097*math.cos(math.radians(t['p'][1]))/2**17 for t in model.values())},'operational_interpretation_tolerance_m':8,'field_validated':False,'year_coverage':yearsummary,'large_adjustments':large,'failed_integrity_assertions':0,'limitations':['8m is a visual interpretation tolerance, not measured physical accuracy or a calibrated standard uncertainty.','Tide, wave setup, beach slope, relative orthoregistration and capture mosaic seams are not globally corrected.','One profile/date is explicitly rejected at a source footprint seam; missing years have null measurements rather than interpolation disguised as observation.','Only the 134 references in 2011 have a second-agent independent visual review at this stage.']}
(ROOT/'docs/qa/dzemul-review-validation-20261105.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in summary.items()if k not in['large_adjustments','year_coverage']}),flush=True)
