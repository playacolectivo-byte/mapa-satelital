"""Record the completed independent Hunucma temporal visual review.

Only separate audit artifacts are written; scientific assets stay untouched.
"""
from pathlib import Path
import collections,datetime,hashlib,json
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/dzemul-audit-20261105/hunucma-independent';input=json.loads((QA/'input.json').read_text(encoding='utf-8'));path=ROOT/'public/data/shorelines/photo-alignment/manual-hunucma-20261105.json';raw=path.read_bytes();assert hashlib.sha256(raw).hexdigest()==input['source_overlay_sha256'];overlay=json.loads(raw);photos=json.loads((ROOT/'public/data/municipalities/hunucma/photos.json').read_text(encoding='utf-8'));rows=input['readings'];assert len(rows)==795
keys=[]
for r in rows:
 key=(r['profile_id'],r['capture'],r['releases'][0]);keys.append(key);capture=photos['captures'][r['capture']];assert capture['date']==r['date']
 release=r['releases'][0];keyhash=hashlib.sha256(r['metadata_url'].encode()).hexdigest()[:16];metadata=ROOT/f'work/hunucma-audit-20261105/later-endpoint-metadata/{release}-{r["profile_id"]}-{keyhash}.json';data=metadata.read_bytes();assert hashlib.sha256(data).hexdigest()==r['metadata_sha256'];features=json.loads(data)['features'];assert len(features)==1;attrs=features[0]['attributes'];date=datetime.datetime.fromtimestamp(attrs['SRC_DATE2']/1000,datetime.timezone.utc).date().isoformat();assert date==r['date']and attrs['SRC_DESC']==capture['source'];assert hashlib.sha256((ROOT/r['panel']).read_bytes()).hexdigest()==r['panel_sha256']
 r['cross_review_status']='visible_apparent_water_sand_boundary_compatible_within_8m';r['independent_reviewer']='dzemul_audit';r['interpretation_tolerance_m']=8;r['field_validated']=False;r['metadata_rechecked']=True;r['independent_panel']=str((QA/f'cross-{r["index"]//20*20:03}.png').relative_to(ROOT))
assert len(keys)==len(set(keys))==795
# Explicitly preserve the release-specific mismatch rather than treating a
# review of the same capture in another release as global approval.
assert('SC-5-0-156',52,15045)not in keys
assert('SC-5-0-156',52,20753)in keys
report={'reviewer':'dzemul_audit independent visual crosscheck','date':'2026-11-05','source_scope_key':'Hunucma','scope':'795 approved non-2011 readings only; does not approve excluded or pending source editions','status':'independent_visual_review_completed','input_overlay_sha256':input['source_overlay_sha256'],'readings_individually_inspected':795,'source_metadata_dates_and_sensors_rechecked':795,'original_source_panel_hashes_rechecked':795,'review_panels_inspected':[f'cross-{n:03}.png'for n in range(0,795,20)],'evidence_directory':str(QA.relative_to(ROOT)),'clear_discrepancies_over8m':[],'operational_interpretation_tolerance_m':8,'field_validated':False,'releases':dict(collections.Counter(r['releases'][0]for r in rows)),'records':rows,'notes':['Every approved marker was compared individually against retained native-derived RGB water/sand strips. 0.5m/display pixel and +/-24m context around the approved marker; required contact compatibility within +/-16px.','Waves and foam were interpreted as an apparent photographic contact; this is not a tide-corrected, surveyed shoreline or a certified accuracy estimate.','No unreviewed RGB candidates were promoted and no Hunucma scientific assets were edited.','The source mismatch SC-5-0-156/c52 in release15045 remains excluded; the date/source verified occurrence in release20753 is a distinct approval.']}
dest=ROOT/'docs/qa/hunucma-independent-temporal-review-20261105.json';dest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print({'inspected':795,'metadata_verified':795,'clear_discrepancies_over8m':0,'report':str(dest)})
