"""Render every baseline proposal for visual review; never publish a detector as ground truth."""
from pathlib import Path
import json
import numpy as np
from scipy.ndimage import uniform_filter,gaussian_filter1d
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/progreso-full-review-20261105'
data=np.load(QA/'baseline-samples.npz');records=json.loads((QA/'baseline-inventory.json').read_text(encoding='utf-8'))['records'];models=np.load(QA/'rgb-proposal-model.npz');offsets=data['offsets'];samples=data['samples']
def propose(im):
 a=im.astype('float32')/255;mu=uniform_filter(a,size=(15,7,1));sd=np.sqrt(np.maximum(0,uniform_filter(a*a,size=(15,7,1))-mu*mu));x=np.concatenate([a,mu,sd],axis=2);scores=[]
 for j in [0,1]:
  d=x-models[f'mean_{j}'];scores.append(-.5*(np.einsum('...i,ij,...j->...',d,models[f'inverse_{j}'],d)+models[f'logdet_{j}']))
 p=1/(1+np.exp(np.clip(scores[0]-scores[1],-50,50)));curve=gaussian_filter1d(np.median(p,axis=1),3);indices=np.where((curve[:-1]>=.5)&(curve[1:]<.5))[0];candidates=[]
 for i in indices:
  if i<30 or i>len(offsets)-30:continue
  contrast=float(curve[i-30:i].mean()-curve[i+1:i+31].mean())
  if contrast>.35:candidates.append({'offset_m':round(float(offsets[i]+(offsets[i+1]-offsets[i])*(curve[i]-.5)/(curve[i]-curve[i+1])),1),'contrast':contrast})
 return sorted(candidates,key=lambda c:-c['contrast'])
order=sorted(range(len(records)),key=lambda i:(records[i]['p'][0],records[i]['p'][1]));rows=[]
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',12)
for start in range(0,len(order),14):
 group=order[start:start+14];out=Image.new('RGB',(14*80+44,680),'#142a30');draw=ImageDraw.Draw(out)
 for j,i in enumerate(group):
  r=records[i];candidates=propose(samples[i]);row={'profile_id':r['profile_id'],'capture':r['capture'],'date':r['date'],'index':i,'candidates':candidates,'panel':start};rows.append(row)
  im=Image.fromarray(samples[i]).resize((80,601));out.paste(im,(44+j*80,45));draw.text((47+j*80,5),r['profile_id'].replace('SC-',''),font=font,fill='white');draw.text((47+j*80,23),str(start+j),font=font,fill='white')
  x=44+j*80;old=r['previous']['offset_m']
  if old is not None:y=45+(150-old)*2;draw.line((x+5,y,x+74,y),fill='#00dcff',width=2)
  if candidates:y=45+(150-candidates[0]['offset_m'])*2;draw.line((x+16,y,x+63,y),fill='#ff384c',width=2)
  draw.line((x+40,45,x+40,646),fill='#ddc748',width=1)
 for off in range(-140,151,20):y=45+(150-off)*2;draw.text((2,y-7),str(off),font=font,fill='white');draw.line((44,y,1164,y),fill='#315359',width=1)
 draw.text((44,657),'TOP = SEA (+150m), BOTTOM = LAND (-150m). Cyan: old candidate. Red: unapproved RGB proposal. Yellow: profile.',font=font,fill='white')
 out.save(QA/f'baseline-proposals-{start:03}.png')
(QA/'baseline-proposals.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('Rendered',len(rows),'profiles in',len(range(0,len(order),14)),'panels',flush=True)
