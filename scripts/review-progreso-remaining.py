"""Render the 3,180 non-overlapping remaining dated Progreso observations.

RGB outputs are unapproved proposals. No reading is approved in this script.
"""
from pathlib import Path
import hashlib,json
import numpy as np
from scipy.ndimage import gaussian_filter1d,uniform_filter
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/progreso-full-review-20261105';OUT=ROOT/'work/progreso-remaining-review-20261105';OUT.mkdir(parents=True,exist_ok=True)
inventory_path=QA/'all-dates-inventory.json';sample_path=QA/'all-dates-samples.npz';inventory=json.loads(inventory_path.read_text(encoding='utf-8'));records=inventory['records'];data=np.load(sample_path);samples=data['samples'];offsets=data['offsets'];models=np.load(QA/'rgb-proposal-model.npz')
latest_path=ROOT/'work/progreso-year-review-20261105/latest-proposals.json';latest=json.loads(latest_path.read_text(encoding='utf-8'));excluded={r['source_index']for r in latest['rows']};indices=[i for i,r in enumerate(records)if r['capture']!=40 and not r['date'].startswith('2015')and i not in excluded];indices.sort(key=lambda i:(records[i]['date'],records[i]['p'][0],records[i]['p'][1]));assert len(indices)==3180
references={r['profile_id']:r['previous']['offset_m']for r in records if r['capture']==40}
for name in ['manual-progreso-oeste-20261105.json','user-guides-2011-20261105.json','manual-progreso-full-20261105.json']:
 for r in json.loads((ROOT/'public/data/shorelines/photo-alignment'/name).read_text(encoding='utf-8'))['corrections']:
  if r['capture']==40:references[r['profile_id']]=r['offset_m']
def propose(im):
 a=im.astype('float32')/255;mu=uniform_filter(a,size=(15,7,1));sd=np.sqrt(np.maximum(0,uniform_filter(a*a,size=(15,7,1))-mu*mu));x=np.concatenate([a,mu,sd],axis=2);scores=[]
 for k in [0,1]:
  d=x-models[f'mean_{k}'];scores.append(-.5*(np.einsum('...i,ij,...j->...',d,models[f'inverse_{k}'],d)+models[f'logdet_{k}']))
 p=1/(1+np.exp(np.clip(scores[0]-scores[1],-50,50)));curve=gaussian_filter1d(np.median(p,axis=1),3);candidates=[]
 for i in np.where((curve[:-1]>=.5)&(curve[1:]<.5))[0]:
  if i<30 or i>len(offsets)-30:continue
  contrast=float(curve[i-30:i].mean()-curve[i+1:i+31].mean())
  if contrast>.35:candidates.append({'offset_m':round(float(offsets[i]+(offsets[i+1]-offsets[i])*(curve[i]-.5)/(curve[i]-curve[i+1])),1),'contrast':contrast})
 return sorted(candidates,key=lambda c:-c['contrast'])
rows=[];COLUMNS=24;WIDTH=64;TOP=48;CENTER=148
for start in range(0,len(indices),COLUMNS):
 selected=indices[start:start+COLUMNS];panel=Image.new('RGB',(32+len(selected)*WIDTH,284),'#142a30');draw=ImageDraw.Draw(panel)
 for j,i in enumerate(selected):
  r=records[i];base=references.get(r['profile_id']);base=0 if base is None else base;rgb=Image.fromarray(samples[i]).resize((WIDTH,601));cy=round(2*(150-base));strip=rgb.crop((0,cy-100,WIDTH,cy+101));x=32+j*WIDTH;panel.paste(strip,(x,TOP));candidates=propose(samples[i]);old=r['previous']['offset_m']
  draw.text((x,0),r['profile_id'].replace('SC-','').replace('-0-','-'),fill='white');draw.text((x,11),r['date'][2:],fill='white');draw.text((x,22),f'{start+j} c{r["capture"]}',fill='white');draw.text((x,33),f'b{base} o{old}',fill='#22ccff');draw.line((x+31,TOP,x+31,TOP+200),fill='#cccc00')
  if old is not None:
   y=CENTER+2*(base-old)
   if TOP<=y<=TOP+200:draw.line((x+3,y,x+60,y),fill='#00dcff',width=2)
  for k,c in reversed(list(enumerate(candidates[:2]))):
   y=CENTER+2*(base-c['offset_m'])
   if TOP<=y<=TOP+200:draw.line((x+12,y,x+51,y),fill='#ff384c'if k==0 else'#ffad38',width=2)
  rows.append({'display_index':start+j,'source_index':i,'profile_id':r['profile_id'],'capture':r['capture'],'date':r['date'],'release':r['release'],'source':r['source'],'p':r['p'],'v':r['v'],'previous':r['previous'],'baseline_offset_m':base,'baseline_available':r['profile_id']in references,'candidates':candidates,'panel':start,'review_status':'pending'})
 for rel in [-40,-20,0,20,40]:
  y=CENTER-rel*2;draw.text((0,y-4),str(rel),fill='white');draw.line((32,y,panel.width,y),fill='#405e65')
 draw.text((3,253),'2011-centred +/-50m. cyan old; red/orange UNAPPROVED RGB proposals; y148=manual 2011. 0.5m/display px.',fill='white');draw.text((3,268),'Visible water/sand contact requires explicit review; native source z17. No automatic approvals.',fill='white');path=OUT/f'remaining-{start:04}.png';panel.save(path);sha=hashlib.sha256(path.read_bytes()).hexdigest()
 for row in rows[-len(selected):]:row.update(evidence_panel=str(path.relative_to(ROOT)),evidence_panel_sha256=sha)
 if start%240==0:print('Rendered',start+len(selected),'/',len(indices),flush=True)
result={'status':'unapproved_visual_proposals','source_inventory_sha256':hashlib.sha256(inventory_path.read_bytes()).hexdigest(),'source_samples_sha256':hashlib.sha256(sample_path.read_bytes()).hexdigest(),'excluded_latest_sha256':hashlib.sha256(latest_path.read_bytes()).hexdigest(),'coordinate_contract':'longitude,latitude in WGS84; offset metres along fixed model normal; apparent image contact only','rows':rows}
(OUT/'remaining-proposals.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print('Completed',len(rows),flush=True)
