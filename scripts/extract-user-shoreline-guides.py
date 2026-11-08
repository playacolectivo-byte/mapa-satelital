"""Extract only the supplied white strokes and intersect the existing profiles."""
from pathlib import Path
import hashlib,json,math
import cv2
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/shoreline-user-guides-20261105'
reg=json.loads((QA/'registration.json').read_text(encoding='utf-8'))
SIZE=256*2**reg['zoom'];origin=np.array(reg['origin_pixel'])
def pixel(p):return np.array([(p[0]+180)/360*SIZE,(1-math.asinh(math.tan(math.radians(p[1])))/math.pi)/2*SIZE])-origin
results=[]
for guide in reg['guides']:
 n=guide['guide'];im=np.array(Image.open(QA/f'guide-{n:02}.png').convert('RGB'));h,w=im.shape[:2]
 mask=((im.min(axis=2)>=246)&(im.max(axis=2)-im.min(axis=2)<=6)).astype('uint8')
 mask[:155]=0;mask[h-125:]=0
 count,labels,stats,_=cv2.connectedComponentsWithStats(mask,8)
 components=[i for i in range(1,count) if stats[i,cv2.CC_STAT_AREA]>=40 and (stats[i,cv2.CC_STAT_WIDTH]>=30 or stats[i,cv2.CC_STAT_HEIGHT]>=25)]
 mask=np.isin(labels,components).astype('uint8');Image.fromarray(mask*255).save(QA/f'stroke-mask-{n:02}.png')
 y,x=np.where(mask);screen=np.stack([x,y],axis=1);A=np.array(guide['affine_screen_to_mosaic']);native=screen@A[:,:2].T+A[:,2]
 inv=cv2.invertAffineTransform(A);overlay=Image.fromarray(im);draw=ImageDraw.Draw(overlay)
 crossings=[]
 for t in reg['profiles']:
  p=pixel(t['p']);normal=np.array([t['v'][0],-t['v'][1]]);tangent=np.array([-normal[1],normal[0]])
  mpp=156543.03392804097*math.cos(math.radians(t['p'][1]))/2**reg['zoom']
  delta=native-p;along=delta@tangent;offset=(delta@normal)*mpp
  good=(np.abs(along)<abs(A[0,0])*1.25)&(np.abs(offset)<190)
  values=np.sort(offset[good]);
  if len(values)<2:continue
  clusters=np.split(values,np.where(np.diff(values)>2.5)[0]+1)
  clusters=[c for c in clusters if len(c)>=2]
  if not clusters:continue
  # Each cluster is the finite width of a white stroke crossing this axis.
  # Preserve alternatives for inspection instead of inventing a smooth coast.
  candidates=[float(np.median(c)) for c in clusters]
  for off in candidates:
   coord=p+normal*off/mpp;s=coord@inv[:,:2].T+inv[:,2]
   draw.ellipse((s[0]-5,s[1]-5,s[0]+5,s[1]+5),outline='#f000ce',width=2)
   draw.text((s[0]+7,s[1]-3),t['id'].replace('SC-',''),fill='#f000ce',stroke_width=1,stroke_fill='black')
  crossings.append({'profile_id':t['id'],'offset_candidates_m':candidates,'guide':n,'stroke_pixels':int(good.sum())})
 overlay.save(QA/f'crossings-{n:02}.png');results.extend(crossings)
 print(n,len(crossings),[(c['profile_id'],[round(x,2) for x in c['offset_candidates_m']]) for c in crossings],flush=True)
(QA/'crossings.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
