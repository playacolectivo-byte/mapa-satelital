"""Native 2D evidence panels; no detector and no mutation of observations."""
from pathlib import Path
import json,math,hashlib,functools
import numpy as np
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'work/chicxulub-reference-review-20261106';OUT.mkdir(parents=True,exist_ok=True)
model=json.loads((ROOT/'public/data/municipalities/progreso/scenario.json').read_text(encoding='utf-8'))
photo_bytes=(ROOT/'public/data/municipalities/progreso/photos.json').read_bytes();photos=json.loads(photo_bytes);byid={t['id']:t for t in photos['targets']}
size=256*2**17
def pixel(p):return np.array([(p[0]+180)/360*size,(1-math.asinh(math.tan(math.radians(p[1])))/math.pi)/2*size])
def coordinate(t,d):
 lon,lat=t['p'];s=math.cos(math.radians(lat));x=6378137*math.radians(lon)+t['v'][0]*d/s;y=6378137*math.asinh(math.tan(math.radians(lat)))+t['v'][1]*d/s
 return [math.degrees(x/6378137),math.degrees(math.atan(math.sinh(y/6378137))) ]
@functools.lru_cache(maxsize=128)
def tile(x,y):
 p=ROOT/f'work/progreso-full-review-20261105/tiles/11019/17-{x}-{y}.jpg'
 assert p.exists(),str(p)
 return Image.open(p).convert('RGB')
rows=[]
for t in sorted(model['targets'],key=lambda t:(t['p'][0],t['p'][1])):
 if not t['type'].startswith('Playa') or not -89.6442<=t['p'][0]<=-89.5702:continue
 source=byid[t['id']];r=next(r for r in source['readings'] if r['capture']==40);d=r['offset_m'] if r['offset_m'] is not None else 0
 c=coordinate(t,d);rows.append({'index':len(rows),'id':t['id'],'p':t['p'],'v':t['v'],'current_offset_m':d,'current_coordinate':c,'current_reference':source.get('fixed_reference'),'previous':r,'side':'west' if t['p'][0]<-89.6071692 else 'east'})
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',13)
for side in ['west','east']:
 selected=[r for r in rows if r['side']==side];folder=OUT/side;folder.mkdir(exist_ok=True)
 for start in range(0,len(selected),6):
  output=Image.new('RGB',(1152,690),'#132c33');draw=ImageDraw.Draw(output)
  for n,r in enumerate(selected[start:start+6]):
   px=pixel(r['current_coordinate']);origin=np.rint(px-[128,100]).astype(int);lo=np.floor(origin/256).astype(int);hi=np.floor((origin+[255,179])/256).astype(int)
   mosaic=Image.new('RGB',tuple((hi-lo+1)*256))
   for y in range(lo[1],hi[1]+1):
    for x in range(lo[0],hi[0]+1):mosaic.paste(tile(x,y),tuple((np.array([x,y])-lo)*256))
   local=origin-lo*256;native=mosaic.crop((local[0],local[1],local[0]+256,local[1]+180)).resize((384,270),Image.Resampling.NEAREST)
   x=(n%3)*384;y=(n//3)*345+46;output.paste(native,(x,y));draw.text((x+5,y-40),f'{r["index"]}: {r["id"]}',font=font,fill='white');draw.text((x+5,y-22),f'2011-08-01; current {r["current_offset_m"]}m',font=font,fill='white')
   mpp=156543.03392804097*math.cos(math.radians(r['p'][1]))/2**17;v=np.array([r['v'][0],-r['v'][1]]);localpx=px-origin
   ends=[localpx+v*d/mpp for d in [-110,110]]
   draw.line([(x+q[0]*1.5,y+q[1]*1.5) for q in ends],fill='#e8d044',width=1)
   cx=x+localpx[0]*1.5;cy=y+localpx[1]*1.5;draw.ellipse((cx-4,cy-4,cx+4,cy+4),outline='#00eaff',width=2)
   for d in range(-80,81,10):
    q=localpx+v*d/mpp;qx=x+q[0]*1.5;qy=y+q[1]*1.5
    if x<qx<x+384 and y<qy<y+270:draw.line((qx-3,qy,qx+3,qy),fill='#e8d044',width=1)
   r['panel']=str((folder/f'context-{start:03}.png').relative_to(ROOT));r['panel_cell']=n;r['pixel_origin']=origin.tolist();r['old_pixel']=px.tolist();r['mpp']=mpp
  output.save(folder/f'context-{start:03}.png')
  for r in selected[start:start+6]:r['panel_sha256']=hashlib.sha256((ROOT/r['panel']).read_bytes()).hexdigest()
 manifest={'photos_sha256':hashlib.sha256(photo_bytes).hexdigest(),'rows':selected}
 (folder/'inventory.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(OUT/'inventory.json').write_text(json.dumps({'source_photos_sha256':hashlib.sha256(photo_bytes).hexdigest(),'rows':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'total':len(rows),'west':sum(r['side']=='west' for r in rows),'east':sum(r['side']=='east' for r in rows)}))
