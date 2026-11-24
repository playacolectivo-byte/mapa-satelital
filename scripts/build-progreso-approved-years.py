"""Package explicit dated visual decisions for root integration; writes work/ only."""
from pathlib import Path
import collections,hashlib,json
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/progreso-year-review-20261105'
before_path=ROOT/'work/progreso-full-review-20261105/before-full-photos.json'
photos=json.loads(before_path.read_text(encoding='utf-8'));lookup={t['id']:t for t in photos['targets']};raw=ROOT/'public/data/shorelines/photo-alignment/revised-data.json';inventory=json.loads((ROOT/'work/progreso-full-review-20261105/all-dates-inventory.json').read_text(encoding='utf-8'))['records']
result={'version':1,'status':'proposed_for_independent_visual_review','method':'manual-progreso-dated-visible-edges-20261105','field_validated':False,'data_sha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'model_sha256':photos['model_sha256'],'sources':[],'corrections':[],'reviewed_readings':[],'rejected_readings':[],'pending_readings':[],'qa':{},'notes':['Only explicit visually reviewed positions with exact endpoint acquisition date/sensor verification are proposed; a second independent visual pass remains required before integration.','All other dated readings remain pending; no previous accepted flag or RGB score authorizes them.','8m is an operational visual interpretation tolerance, not a standard deviation, field validation or certified geolocation accuracy.','No tide, beach-slope, wave or inter-year registration correction is certified.']}
states={i:{'profile_id':r['profile_id'],'capture':r['capture'],'date':r['date'],'release':r['release'],'source_index':i,'status':'pending_not_visually_reviewed_in_this_package'} for i,r in enumerate(inventory)}
seen=set();group_counts={}
for path in sorted((ROOT/'docs/qa').glob('progreso-*-endpoint-review-20261105.json')):
    review=json.loads(path.read_text(encoding='utf-8'));group=review['group'];group_counts[group]=review['counts']
    for r in review['readings']:
        states[r['source_index']]['status']=r['status'];key=(r['profile_id'],r['capture'])
        if r['status']=='verified_visual_position_and_exact_endpoint_source':
            if key in seen:continue
            seen.add(key);original=next(x for x in lookup[r['profile_id']]['readings'] if x['capture']==r['capture']);source_id=f'progreso-{group}-{r["profile_id"]}-{r["capture"]}-{r["release"]}'
            source={'id':source_id,'release':r['release'],'capture_date':r['date'],'screenshot_sha256':r['evidence_panel_sha256'],'panel':r['evidence_panel'],'panel_pixel':[(r['display_index']%14)*80+84,r['reviewed_panel_row']],'coordinate':r['corrected_coordinate'],'metadata_url':r['metadata_url'],'metadata_sha256':r['metadata_sha256'],'metadata_cache':r['metadata_cache'],'source_resolution_m':r['verified_source']['resolution_m'],'source_accuracy_m':r['verified_source']['accuracy_m'],'visual_decision':r['decision']}
            source['metadata_endpoint_verified']=True;source['metadata_verification_method']=r.get('metadata_verification_method','official_point_query_at_exact_endpoint')
            for extra in ['footprint_feature_index','footprint_point_crosscheck_passed']:
                if extra in r:source[extra]=r[extra]
            result['sources'].append(source)
            if r['offset_m']!=original['offset_m'] or not original['accepted']:
                result['corrections'].append({'profile_id':r['profile_id'],'capture':r['capture'],'date':r['date'],'releases':[r['release']],'original_offset_m':original['offset_m'],'original_accepted':original['accepted'],'offset_m':r['offset_m'],'manual_uncertainty_m':8,'source':source_id})
            else:result['reviewed_readings'].append({'profile_id':r['profile_id'],'capture':r['capture'],'date':r['date'],'releases':[r['release']],'visual_status':'accepted','offset_m':r['offset_m'],'source':source_id})
        elif r['status'].startswith('rejected'):
            result['rejected_readings'].append({'profile_id':r['profile_id'],'capture':r['capture'],'releases':[r['release']],'reason':'exact_reviewed_endpoint_has_different_acquisition_date_or_sensor','expected_date':r['date'],'verified_source':r.get('verified_source'),'metadata_url':r.get('metadata_url'),'metadata_sha256':r.get('metadata_sha256')})
        else:result['pending_readings'].append({'profile_id':r['profile_id'],'capture':r['capture'],'releases':[r['release']],'reason':r['status']})
    for r in review['pending']:
        states[r['source_index']]['status']=r['status'];result['pending_readings'].append({'profile_id':r['profile_id'],'capture':r['capture'],'releases':[r['release']],'reason':r['status']})
result['qa']={'immutable_original_photos_snapshot':str(before_path.relative_to(ROOT)),'immutable_original_photos_sha256':hashlib.sha256(before_path.read_bytes()).hexdigest(),'groups':group_counts,'all_dated_reading_status_counts':dict(collections.Counter(r['status'] for r in states.values())),'all_dated_readings':list(states.values()),'reviewed_source_count':len(result['sources']),'new_correction_count':len(result['corrections']),'unchanged_visually_reviewed_count':len(result['reviewed_readings']),'rejected_source_readings':len(result['rejected_readings']),'explicit_pending_reviewed_cases':len(result['pending_readings'])}
second_passes={}
for group in group_counts:
    second_pass=ROOT/f'docs/qa/progreso-{group}-independent-visual-review-20261105.json'
    if second_pass.exists():
        checked=json.loads(second_pass.read_text(encoding='utf-8'));second_passes[group]={'report':str(second_pass.relative_to(ROOT)),'sha256':hashlib.sha256(second_pass.read_bytes()).hexdigest(),'status':checked.get('status')}
result['qa']['independent_visual_second_pass']=second_passes
if group_counts and all(second_passes.get(group,{}).get('status')=='independent_visual_review_complete' for group in group_counts):
    result['status']='independently_reviewed';result['notes'][0]='Every included dated group has an independent second visual pass recorded in qa; only explicit visually reviewed positions with exact endpoint acquisition date/sensor verification are approved.'
assert len(states)==4592 and len(seen)==len(result['sources'])
(QA/'approved-years.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in result['qa'].items() if k!='all_dated_readings'}))
