"""Compile explicit image choices into a source-gated, reviewable overlay."""
from pathlib import Path
import datetime,hashlib,json,math
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'work/progreso-remaining-review-20261105';input=json.loads((OUT/'remaining-proposals.json').read_text(encoding='utf-8'));choices=json.loads((OUT/'manual-row-choices.json').read_text(encoding='utf-8'));rows=input['rows'];sources=json.loads((OUT/'source-manifest.json').read_text(encoding='utf-8'));rawpath=ROOT/'public/data/shorelines/photo-alignment/revised-data.json';raw=json.loads(rawpath.read_text(encoding='utf-8'))
sidecar_path=OUT/'manual-row-choices-1992-3179.json'
if sidecar_path.exists():
 sidecar=json.loads(sidecar_path.read_text(encoding='utf-8'));assert all(1992<=int(key)<=3168 for key in sidecar);assert not set(choices).intersection(sidecar);choices.update(sidecar)
result={'version':1,'status':'proposed_for_independent_visual_review','method':'manual-progreso-remaining-dated-water-sand-20261106','field_validated':False,'data_sha256':hashlib.sha256(rawpath.read_bytes()).hexdigest(),'model_sha256':raw['model_sha256'],'sources':[],'corrections':[],'reviewed_readings':[],'rejected_readings':[],'pending_readings':[],'states':[],'notes':['Only explicit operator choices are proposals; RGB outputs and old accepted flags are not automatic approvals.','8m is operational visual interpretation tolerance, not standard uncertainty or field validation.','No tide, wave, beach slope or inter-year registration correction is certified.']}
def inring(p,ring):
 x,y=p;inside=False
 for a,b in zip(ring,ring[1:]+ring[:1]):
  if(a[1]>y)!=(b[1]>y)and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
 return inside
footprints={key:json.loads((ROOT/s['path']).read_text(encoding='utf-8'))['features']for key,s in sources.items()if'path'in s}
for panel,values in choices.items():assert len(values)==len(rows[int(panel):int(panel)+24]),panel
for n,r in enumerate(rows):
 start=n//24*24;values=choices.get(str(start));choice=None if values is None else values[n%24];state={**r,'visual_choice':choice};identity={k:r[k]for k in['display_index','source_index','profile_id','capture','date','release']}
 if choice is None:state['status']='pending_visual_review';result['pending_readings'].append({**identity,'reason':state['status']});result['states'].append(state);continue
 if isinstance(choice,str):state['status']=choice;result['pending_readings'].append({**identity,'reason':choice});result['states'].append(state);continue
 manual_offset=round(float(choice['offset_m'])if isinstance(choice,dict)else r['baseline_offset_m']+(148-choice)/2,1);metadata=sources[str(r['release'])];features=footprints.get(str(r['release']),[])
 def verify(position):
  lon,lat=r['p'];radius=6378137;scale=math.cos(math.radians(lat));xx=radius*math.radians(lon)+r['v'][0]*position/scale;yy=radius*math.asinh(math.tan(math.radians(lat)))+r['v'][1]*position/scale;coordinate=[math.degrees(xx/radius),math.degrees(math.atan(math.sinh(yy/radius)))];matching=[f for f in features if sum(inring(coordinate,ring)for ring in f['geometry']['rings'])%2==1];valid=[]
  for f in matching:
   a=f['attributes'];date=datetime.datetime.fromtimestamp(a['SRC_DATE2']/1000,datetime.timezone.utc).date().isoformat()
   if date==r['date']and a['SRC_DESC']==r['source']['source']:valid.append(f)
  return coordinate,matching,valid
 offset=manual_offset;coordinate,matching,valid=verify(offset);retained=False;old=r['previous']
 # An explicitly inspected old marker already compatible with the operator's
 # apparent contact within the 8m tolerance does not justify a small numerical
 # change. Retain it only if previously accepted AND its own endpoint source
 # also checks. Rejected old readings and clear discrepancies use the explicit
 # manual interpretation. This is not automatic model approval.
 if old['accepted']and old['offset_m']is not None and abs(old['offset_m']-manual_offset)<=8:
  old_coordinate,old_matching,old_valid=verify(old['offset_m'])
  if len(old_valid)==len(old_matching)==1:offset=old['offset_m'];coordinate,matching,valid=old_coordinate,old_matching,old_valid;retained=True
 evidence_panel=choice['panel']if isinstance(choice,dict)else r['evidence_panel'];evidence_sha=hashlib.sha256((ROOT/evidence_panel).read_bytes()).hexdigest();evidence_pixel=choice['panel_pixel']if isinstance(choice,dict)else[32+n%24*64+31,148+2*(r['baseline_offset_m']-offset)]
 if isinstance(choice,dict)and retained:evidence_pixel=[choice['panel_pixel'][0],345-2*offset]
 source_id=f'progreso-remaining-{r["source_index"]}';source={'id':source_id,'release':r['release'],'capture_date':r['date'],'panel':evidence_panel,'screenshot_sha256':evidence_sha,'panel_pixel':evidence_pixel,'coordinate':coordinate,'metadata_url':metadata['url'],'metadata_sha256':metadata.get('sha256'),'metadata_endpoint_verified':len(valid)==len(matching)==1,'covering_footprints':len(matching),'source_accuracy_m':r['source']['accuracy_m'],'source_resolution_m':r['source']['resolution_m'],'sampling_zoom':17}
 if isinstance(choice,dict)and'context_panels'in choice:source['context_panels']=[{'panel':p,'sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest()}for p in choice['context_panels']]
 result['sources'].append(source);state.update(proposed_offset_m=offset,manual_interpreted_offset_m=manual_offset,previous_value_retained_within_tolerance=retained,coordinate=coordinate,source_id=source_id)
 if len(valid)==len(matching)==1:
  state['status']='visually_interpreted_source_verified';old=r['previous'];result['corrections'].append({'profile_id':r['profile_id'],'capture':r['capture'],'date':r['date'],'releases':old['releases'],'original_offset_m':old['offset_m'],'original_accepted':old['accepted'],'offset_m':offset,'manual_uncertainty_m':8,'source':source_id})
 else:
  state['status']='pending_source_transport_retry'if'error'in metadata else'pending_source_endpoint_mismatch_or_missing';result['pending_readings'].append({**identity,'reason':state['status'],'proposed_offset_m':offset,'covering_features':len(matching),'dated_source_matches':len(valid)})
  if'error'not in metadata:result['rejected_readings'].append({'profile_id':r['profile_id'],'capture':r['capture'],'date':r['date'],'releases':[r['release']],'reason':state['status'],'visual_status':'pending','source':source_id})
 result['states'].append(state)
for panel,values in choices.items():
 start=int(panel);im=Image.open(OUT/f'remaining-{start:04}.png').convert('RGB');draw=ImageDraw.Draw(im)
 for j,choice in enumerate(values):
  if isinstance(choice,(float,int)):
   state=result['states'][start+j];y=148+2*(rows[start+j]['baseline_offset_m']-state['proposed_offset_m']);draw.line((32+j*64+6,y,32+j*64+57,y),fill='#ff9020',width=2)
  elif isinstance(choice,dict):draw.text((32+j*64,225),'EXPANDED',fill='#ff9020')
  elif choice is not None:draw.text((32+j*64,110),'PENDING',fill='#ffaa00')
 im.save(OUT/f'manual-{start:04}.png')
result['qa']={'total_expected':len(rows),'visually_chosen':sum(isinstance(v,(int,float,dict))for values in choices.values()for v in values),'source_verified':len(result['corrections']),'previous_values_retained_within_visual_tolerance':sum(s.get('previous_value_retained_within_tolerance',False)for s in result['states']),'pending':len(result['pending_readings']),'all_states_recorded':len(result['states']),'source_inventory_sha256':input['source_inventory_sha256'],'source_samples_sha256':input['source_samples_sha256']};temporary=OUT/'approved-remaining.json.tmp';temporary.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');temporary.replace(OUT/'approved-remaining.json');print(json.dumps(result['qa']),flush=True)
