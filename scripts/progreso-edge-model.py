"""Experimental RGB boundary proposals, calibrated against held-out user guides.

These predictions are QA proposals only, never automatically accepted readings.
"""
from pathlib import Path
import json,math
import numpy as np
from scipy.ndimage import map_coordinates,uniform_filter,gaussian_filter1d
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/progreso-full-review-20261105';QA.mkdir(parents=True,exist_ok=True)
GUIDES=ROOT/'work/shoreline-user-guides-20261105'
r=json.loads((ROOT/'public/data/shorelines/photo-alignment/user-guides-2011-20261105.json').read_text(encoding='utf-8'));reg=json.loads((GUIDES/'registration.json').read_text(encoding='utf-8'));targets={t['id']:t for t in reg['profiles']}
array=np.array(Image.open(GUIDES/'source-2011.png')).astype(float)/255
mean=uniform_filter(array,size=(7,7,1));std=np.sqrt(np.maximum(0,uniform_filter(array**2,size=(7,7,1))-mean**2))
image=np.concatenate([array,mean,std],axis=2);samples=[];labels=[];groups=[];validation=[]
offsets=np.arange(150,-150.01,-.5);along=np.linspace(-10,10,11);SIZE=256*2**17
for c in r['corrections']:
 t=targets[c['profile_id']];lon,lat=t['p'];p=np.array([(lon+180)/360*SIZE,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*SIZE])-reg['origin_pixel'];scale=156543.03392804097*math.cos(math.radians(lat))/2**17;v=np.array([t['v'][0],-t['v'][1]]);u=np.array([t['v'][1],t['v'][0]])
 xy=p[:,None,None]+v[:,None,None]*offsets[None,:,None]/scale+u[:,None,None]*along[None,None,:]/scale
 features=np.stack([map_coordinates(image[:,:,k],[xy[1],xy[0]],order=1,mode='nearest') for k in range(image.shape[2])],axis=-1)
 source=next(s for s in r['sources'] if s['id']==c['source']);selected=(np.abs(offsets-c['offset_m'])>=5)&(np.abs(offsets-c['offset_m'])<=30)
 samples.append(features[selected].reshape(-1,9));labels.append(np.repeat((offsets[selected]>c['offset_m']).astype(int),len(along)));groups.append(np.full(selected.sum()*len(along),source['guide']))
 validation.append((c,source,features))
X=np.concatenate(samples);Y=np.concatenate(labels);G=np.concatenate(groups)
def fit(x,y):
 result=[]
 for k in [0,1]:
  z=x[y==k];mu=z.mean(0);cov=np.cov(z,rowvar=False)+np.eye(x.shape[1])*.0003
  result.append((mu,np.linalg.inv(cov),np.linalg.slogdet(cov)[1]))
 return result
def predict(model,x):
 scores=[]
 for mu,inv,logdet in model:
  delta=x-mu;scores.append(-.5*(np.einsum('...i,ij,...j->...',delta,inv,delta)+logdet))
 return 1/(1+np.exp(np.clip(scores[0]-scores[1],-50,50)))
def edge(model,features):
 p=predict(model,features);curve=gaussian_filter1d(np.median(p,axis=1),3);cross=np.where((curve[:-1]>=.5)&(curve[1:]<.5))[0]
 candidates=[]
 for i in cross:
  if i<30 or i>len(offsets)-30:continue
  contrast=float(np.mean(curve[i-30:i])-np.mean(curve[i+1:i+31]))
  if contrast>.35:candidates.append((float(offsets[i]+(offsets[i+1]-offsets[i])*(curve[i]-.5)/(curve[i]-curve[i+1])),contrast))
 return sorted(candidates,key=lambda c:-c[1])
rows=[]
for guide in sorted(set(G)):
 model=fit(X[G!=guide],Y[G!=guide])
 for c,s,features in validation:
  if s['guide']!=guide:continue
  candidates=edge(model,features);best=candidates[0][0] if candidates else None
  rows.append({'profile_id':c['profile_id'],'held_out_guide':int(guide),'reference_m':c['offset_m'],'predicted_m':best,'residual_m':None if best is None else best-c['offset_m'],'candidates':candidates})
errors=[abs(x['residual_m']) for x in rows if x['residual_m'] is not None]
report={'note':'Held-out-image RGB proposal model; not accepted shoreline measurements.','total':len(rows),'detected':len(errors),'median_abs_error_m':float(np.median(errors)) if errors else None,'p95_abs_error_m':float(np.quantile(errors,.95)) if errors else None,'within_5m':sum(e<=5 for e in errors),'rows':rows}
(QA/'rgb-guide-cross-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
np.savez(QA/'rgb-proposal-model.npz',**{f'{k}_{j}':x for j,part in enumerate(fit(X,Y)) for k,x in zip(['mean','inverse','logdet'],part)})
print(json.dumps({k:v for k,v in report.items() if k!='rows'}),flush=True)
