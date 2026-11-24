"""Build date-labelled, 2011-centred strips for independent temporal review."""
from pathlib import Path
import json,math
import numpy as np
from PIL import Image,ImageDraw
from scipy.ndimage import map_coordinates
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/dzemul-audit-20261105'
manifest=json.loads((QA/'input-manifest.json').read_text(encoding='utf-8'));proposals=json.loads((QA/'proposals.json').read_text(encoding='utf-8'))
model={t['id']:t for t in manifest['profiles']};refs={r['profile_id']:r['offset_m'] for r in json.loads((ROOT/'public/data/shorelines/photo-alignment/manual-dzemul-20261105.json').read_text(encoding='utf-8'))['corrections']}
SIZE=256*2**17
def sample(row):
 t=model[row['profile_id']];lon,lat=t['p'];p=np.array([(lon+180)/360*SIZE,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*SIZE]);mpp=156543.03392804097*math.cos(math.radians(lat))/2**17;n=np.array([t['v'][0],-t['v'][1]]);a=np.array([t['v'][1],t['v'][0]])
 offsets=refs[t['id']]+50-np.arange(201)*.5;along=(np.arange(64)-31.5)*.6;xy=p[:,None,None]+n[:,None,None]*offsets[None,:,None]/mpp+a[:,None,None]*along[None,None,:]/mpp
 lo=np.floor(xy.min((1,2))/256).astype(int);hi=np.floor(xy.max((1,2))/256).astype(int);im=Image.new('RGB',tuple((hi-lo+1)*256));origin=lo*256
 for y in range(lo[1],hi[1]+1):
  for x in range(lo[0],hi[0]+1):im.paste(Image.open(QA/f'tiles/{row["review_release"]}/17-{x}-{y}.jpg').convert('RGB'),tuple(np.array([x,y])*256-origin))
 array=np.asarray(im);xy-=origin[:,None,None]
 return np.stack([map_coordinates(array[:,:,c],[xy[1],xy[0]],order=1,mode='nearest') for c in range(3)],-1).astype('uint8')
groups={}
for r in proposals:groups.setdefault(r['date'][:4],[]).append(r)
for year,rows in groups.items():
 if year=='2011':continue
 # Same-date provider-specific captures are retained in the manifest, but use
 # distinct separately labelled cells here; never silently merge their values.
 rows.sort(key=lambda r:(model[r['profile_id']]['p'][0],r['date'],r['capture']))
 for start in range(0,len(rows),14):
  panel=Image.new('RGB',(32+80*len(rows[start:start+14]),300),'#172b30');draw=ImageDraw.Draw(panel)
  for j,row in enumerate(rows[start:start+14]):
   x=32+j*80;draw.text((x,1),row['profile_id'].split('-')[-1],fill='white');draw.text((x,12),row['date'][2:],fill='white');draw.text((x,23),f"c{row['capture']} r{row['review_release']}",fill='white');draw.text((x,34),f"old {row['offset_m']}",fill='#22ccff');panel.paste(Image.fromarray(sample(row)),(x,48));draw.line((x+31,48,x+31,248),fill='#cccc00');draw.line((x,148,x+63,148),fill='#f000ff')
   if row['offset_m'] is not None:
    y=148+2*(refs[row['profile_id']]-row['offset_m'])
    if 48<=y<=248:draw.line((x+12,y,x+50,y),fill='#22ccff',width=2)
   if 'offset_m' in row['proposal']:
    y=148+2*(refs[row['profile_id']]-row['proposal']['offset_m'])
    if 48<=y<=248:draw.line((x+5,y,x+58,y),fill='#00ff44' if row['proposal']['accepted'] else '#ff5555',width=2)
  for y in [68,108,148,188,228]:
   draw.line((32,y,panel.width,y),fill='#49626a');draw.text((1,y-4),str((148-y)//2),fill='white')
  draw.text((5,253),'Relative metres to fixed manual 2011; y148 = 2011. cyan old, green/red unapproved RGB candidate.',fill='white');draw.text((5,268),'Visible water/sand interpretation only. 0.5m/display pixel; native source ~1.1m/pixel at z17.',fill='white');panel.save(QA/f'year-{year}-{start:03}.png')
 (QA/f'year-{year}-rows.json').write_text(json.dumps(rows,indent=2)+'\n',encoding='utf-8')
print({year:len(rows) for year,rows in groups.items()})
