"""Retain full +/-150m native-derived windows for explicitly difficult cases."""
from pathlib import Path
import argparse,hashlib,json
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'work/progreso-remaining-review-20261105';parser=argparse.ArgumentParser();parser.add_argument('indices',nargs='+',type=int);args=parser.parse_args();rows=json.loads((OUT/'remaining-proposals.json').read_text(encoding='utf-8'))['rows'];samples=np.load(ROOT/'work/progreso-full-review-20261105/all-dates-samples.npz')['samples'];im=Image.new('RGB',(40+128*len(args.indices),690),'#142a30');draw=ImageDraw.Draw(im)
for j,index in enumerate(args.indices):
 r=rows[index];x=40+j*128;im.paste(Image.fromarray(samples[r['source_index']]).resize((128,601)),(x,45));draw.text((x,0),str(index)+' '+r['profile_id'].replace('SC-',''),fill='white');draw.text((x,12),r['date'],fill='white');draw.text((x,24),'base '+str(r['baseline_offset_m']),fill='white');draw.line((x+64,45,x+64,646),fill='#cccc00');old=r['previous']['offset_m']
 if old is not None:
  y=345-2*old;draw.line((x+8,y,x+120,y),fill='#00dcff',width=2)
for offset in range(-140,151,20):
 y=345-2*offset;draw.text((0,y-5),str(offset),fill='white');draw.line((40,y,im.width,y),fill='#405e65')
draw.text((5,655),'Full original sample +/-150m; y345=offset0m. Cyan old; no classifier used as accepted edge.',fill='white');path=OUT/('expanded-'+'-'.join(map(str,args.indices))+'.png');im.save(path);print({'path':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'indices':args.indices})
