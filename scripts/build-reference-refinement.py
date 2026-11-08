"""Compile separately checked 2011 contacts and detailed source geometry."""
from pathlib import Path
import argparse,datetime,hashlib,json,math
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/chicxulub-reference-review-20261106';PUB=ROOT/'public/data/shorelines/photo-alignment'
parser=argparse.ArgumentParser();parser.add_argument('--stage-controls',action='store_true');parser.add_argument('--stage-geometry',action='store_true');args=parser.parse_args()
assert not (args.stage_controls and args.stage_geometry)
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
before=WORK/'before-reference-refinement-photos.json';photos=read(before);lookup={t['id']:t for t in photos['targets']}
original_scope=read(WORK/'inventory.json');assert original_scope['source_photos_sha256']==sha(before)
model={t['id']:t for t in read(ROOT/'public/data/municipalities/progreso/scenario.json')['targets']}
footprint_file=ROOT/'work/progreso-full-review-20261105/baseline-corrected-endpoint-footprints.json';footprints=read(footprint_file)
assert footprints['spatialReference']['wkid']==4326 and not footprints.get('exceededTransferLimit')
def contained(p,ring):
 x,y=p;inside=False
 for a,b in zip(ring,ring[1:]+ring[:1]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
 return inside
def verify(p):
 matches=[f['attributes'] for f in footprints['features'] if sum(contained(p,r) for r in f['geometry']['rings'])%2]
 assert len(matches)==1,p
 attr=matches[0];assert datetime.datetime.fromtimestamp(attr['SRC_DATE2']/1000,datetime.timezone.utc).date().isoformat()=='2011-08-01' and attr['SRC_DESC']=='WV02',p
 return attr
def coordinate(id,offset):
 t=model[id];lon,lat=t['p'];a=6378137;s=math.cos(math.radians(lat));x=a*math.radians(lon)+t['v'][0]*offset/s;y=a*math.asinh(math.tan(math.radians(lat)))+t['v'][1]*offset/s
 return [math.degrees(x/a),math.degrees(math.atan(math.sinh(y/a)))]

west_file=WORK/'west/manual-decisions.json';west=read(west_file);west_qa=read(ROOT/'docs/qa/chicxulub-2011-west-independent-20261106.json')
assert west_qa['status']=='independent_visual_review_complete' and west_qa['manual_decisions_sha256']==sha(west_file)
east_file=WORK/'east/independent-decisions.json';east=read(east_file)
assert east['status']=='independent_visual_review_complete_refinements_for_root_adjudication'
cases_file=WORK/'cases-final.json';cases=read(cases_file);assert cases['status']=='independently_reviewed' and len(cases['corrections'])==4
dense_file=WORK/'dense-shoreline'/('proposed-geometry.json' if args.stage_geometry else 'approved-geometry.json')
dense={'reference_geometry':[]} if args.stage_controls else read(dense_file)
assert args.stage_controls or dense['status']==('visually_reviewed' if args.stage_geometry else 'independently_reviewed')
decisions=west['records']+east['records'];assert len(decisions)==len(original_scope['rows'])==80
assert {r['id'] for r in decisions}=={r['id'] for r in original_scope['rows']}
corrections=[];sources=[];gaps=[]
for d in decisions:
 id=d['id'];old=next(r for r in lookup[id]['readings'] if r['capture']==40)
 panel=ROOT/d.get('evidence_panel',d['panel']);panel_hash=sha(panel)
 assert panel_hash==d.get('evidence_panel_sha256',d['panel_sha256']),id
 if d['offset_m'] is None:
  gaps.append({'profile_id':id,'capture':40,'reason':'structure_or_shadow_prevents_unique_sand_water_contact','original_offset_m':old['offset_m'],'original_accepted':old['accepted'],'evidence_panel':str(panel.relative_to(ROOT)),'screenshot_sha256':panel_hash});continue
 p=coordinate(id,d['offset_m']);source=verify(p);sid='chicxulub-2011-'+id
 sources.append({'id':sid,'release':11019,'capture_date':'2011-08-01','panel':str(panel.relative_to(ROOT)),'screenshot_sha256':panel_hash,'coordinate':p,'metadata_endpoint_verified':True,'metadata_file':str(footprint_file.relative_to(ROOT)),'metadata_sha256':sha(footprint_file),'source_accuracy_m':source['SRC_ACC'],'source_resolution_m':source['SAMP_RES'],'decision':d['decision']})
 corrections.append({'profile_id':id,'capture':40,'date':'2011-08-01','releases':old['releases'],'original_offset_m':old['offset_m'],'original_accepted':old['accepted'],'offset_m':d['offset_m'],'manual_uncertainty_m':8,'source':sid})
for c in cases['corrections']:
 old=next(r for r in lookup[c['profile_id']]['readings'] if r['capture']==c['capture']);assert old['offset_m']==c['original_offset_m'] and old['accepted']==c['original_accepted']
 verify(coordinate(c['profile_id'],c['offset_m']));corrections.append(c)
for source in cases['sources']:
 assert sha(ROOT/source['panel'])==source['screenshot_sha256'];sources.append(source)
paths=[case['reference_geometry'] for case in cases['cases']]+dense['reference_geometry']
for path in paths:
 coords=path['coordinates'];assert path['municipality']=='Progreso' and len(coords)>1 and all(a[0]<b[0] for a,b in zip(coords,coords[1:]))
 for p in coords:verify(p)
non_barriers=[id for case in cases['cases'] for id in case.get('non_barrier_auxiliary_ids',[])];assert non_barriers==['SC-C392-0-0']
evidence=[west_file,east_file,cases_file,footprint_file]+([] if args.stage_controls else [dense_file])
if not (args.stage_controls or args.stage_geometry):
 qa_file=WORK/'grid-qa/final/independent-review.json';qa=read(qa_file)
 stage_grid=WORK/'grid-geometry-stage.json';stage_asset=read(WORK/'geometry-stage.json')
 assert qa['status']=='independent_visual_review_complete' and qa['grid_sha256']==sha(stage_grid)
 assert qa['needs_adjustment']==qa['unresolved']==0 and qa['accepted']==qa['stations_reviewed']>0
 assert stage_asset['reference_geometry']==paths and stage_asset['corrections']==corrections and stage_asset['uninterpretable_references']==gaps
 stations={s['id']:s['coordinate'] for segment in read(stage_grid)['segments'] if segment['municipality']=='Progreso' for s in segment['stations'] if -89.6442<=s['coordinate'][0]<=-89.5702}
 assert len(qa['rows'])==len(stations)==qa['stations_reviewed']
 assert {s['id']:s['coordinate'] for s in qa['rows']}==stations
 evidence.append(qa_file)
asset={'version':1,'status':'independently_reviewed','reference_year':2011,'field_validated':False,'method':'refined-visible-water-contact-chicxulub-chelem-2011-20261106','data_sha256':sha(PUB/'revised-data.json'),'model_sha256':photos['model_sha256'],'source_photos_sha256':sha(before),'sources':sources,'corrections':corrections,'uninterpretable_references':gaps,'reference_geometry':paths,'non_barrier_auxiliary_ids':non_barriers,'evidence':{str(p.relative_to(ROOT)):sha(p) for p in evidence},'notes':['Chicxulub uses the water-facing visible contact. All 80 controls were read individually.','The two Chelem screenshots were registered to the original 2011 tiles. The auxiliary tangential axis is archived, not turned into a false measurement.','Only 2011 references change. Later observed endpoints and their approvals are preserved.','Orphan locators outside the 100 m grid are hidden in the map but remain archived.']}
if not (args.stage_controls or args.stage_geometry):
 asset['visual_grid_review']={'grid_sha256':qa['grid_sha256'],'chicxulub_stations_reviewed':qa['stations_reviewed'],'review_sha256':sha(qa_file)}
assert len({c['profile_id'] for c in corrections+gaps})==84
destination=(WORK/('controls-stage.json' if args.stage_controls else 'geometry-stage.json')) if args.stage_controls or args.stage_geometry else (PUB/'reference-refinement-20261106.json');temporary=destination.with_suffix('.tmp');temporary.write_text(json.dumps(asset,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');temporary.replace(destination)
print(json.dumps({'corrected_controls':len(corrections),'pending_controls':len(gaps),'geometry_paths':len(paths),'geometry_vertices':sum(len(p['coordinates']) for p in paths),'sha256':sha(destination)}))
