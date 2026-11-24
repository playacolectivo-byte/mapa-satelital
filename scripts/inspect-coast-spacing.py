import json
from pathlib import Path
import numpy as np
from pyproj import Geod
root=Path(__file__).resolve().parents[1]
g=Geod(ellps='WGS84')
for slug in ['progreso','hunucma','dzemul']:
 m=json.loads((root/f'public/data/municipalities/{slug}/scenario.json').read_text())
 p=json.loads((root/f'public/data/municipalities/{slug}/photos.json').read_text())
 targets=[]
 for t,r in zip(m['targets'],p['targets']):
  if not t['type'].startswith('Playa') or not r.get('fixed_reference'): continue
  d=next(v['offset_m'] for v in r['readings'] if v['capture']==r['fixed_reference']['capture'])
  lon,lat=t['p'];scale=np.cos(np.deg2rad(lat));x=6378137*np.deg2rad(lon)+t['v'][0]*d/scale;y=6378137*np.arcsinh(np.tan(np.deg2rad(lat)))+t['v'][1]*d/scale
  targets.append((t['id'],float(np.rad2deg(x/6378137)),float(np.rad2deg(np.arctan(np.sinh(y/6378137))))))
 a=sorted(targets,key=lambda r:r[1]);pairs=[]
 for t,u in zip(a,a[1:]):
  _,_,d=g.inv(t[1],t[2],u[1],u[2]);pairs.append((round(d,2),t[0],u[0]))
 print(slug,len(a),'range',np.percentile([r[0] for r in pairs],[0,10,50,90,100]).tolist(),'close',sum(r[0]<80 for r in pairs))
 print(sorted(pairs)[:30])
 a=[r for r in a if not r[0].startswith('SC-C')];pairs=[]
 for t,u in zip(a,a[1:]):
  _,_,d=g.inv(t[1],t[2],u[1],u[2]);pairs.append((round(d,2),t[0],u[0]))
 print('PRIMARY',len(a),np.percentile([r[0] for r in pairs],[0,10,50,90,100]).tolist(),'close',sum(r[0]<80 for r in pairs))
 print(sorted(pairs)[:12])
