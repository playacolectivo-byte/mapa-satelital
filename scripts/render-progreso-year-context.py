"""North-up native context; cached source tiles only, no generated imagery."""
from pathlib import Path
import argparse,functools,json,math
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/progreso-year-review-20261105';DATA=ROOT/'work/progreso-full-review-20261105';parser=argparse.ArgumentParser();parser.add_argument('--group',default='latest');parser.add_argument('--indices',default='62,63,64,174,579,580,109,220,467,56,60,61');parser.add_argument('--tag',default='native-context');parser.add_argument('--no-markers',action='store_true');args=parser.parse_args()
rows=json.loads((QA/f'{args.group}-proposals.json').read_text(encoding='utf-8'))['rows'];indices=list(map(int,args.indices.split(',')))
@functools.lru_cache(maxsize=64)
def tile(release,x,y):
    path=DATA/f'tiles/{release}/17-{x}-{y}.jpg'
    return Image.open(path).convert('RGB') if path.exists() else Image.new('RGB',(256,256),'#000000')
for start in range(0,len(indices),6):
    out=Image.new('RGB',(960,670),'#142a30');draw=ImageDraw.Draw(out)
    for j,n in enumerate(indices[start:start+6]):
        r=rows[n];lon,lat=r['p'];size=256*2**17;px=np.array([(lon+180)/360*size,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*size]);lo=np.floor((px-100)/256).astype(int);hi=np.floor((px+100)/256).astype(int);mosaic=Image.new('RGB',tuple((hi-lo+1)*256))
        for ty in range(lo[1],hi[1]+1):
            for tx in range(lo[0],hi[0]+1):mosaic.paste(tile(r['release'],tx,ty),((tx-lo[0])*256,(ty-lo[1])*256))
        local=px-lo*256;cl=np.rint(local-100).astype(int);native=mosaic.crop((cl[0],cl[1],cl[0]+200,cl[1]+200)).resize((300,300),Image.Resampling.NEAREST);x=(j%3)*320+5;y=(j//3)*335+30;out.paste(native,(x,y));scale=156543.03392804097*math.cos(math.radians(lat))/2**17;old=r['previous']['offset_m'];point=local+np.array([r['v'][0],-r['v'][1]])*(old or 0)/scale;cx=x+1.5*(point[0]-cl[0]);cy=y+1.5*(point[1]-cl[1])
        if not args.no_markers:draw.ellipse((cx-4,cy-4,cx+4,cy+4),outline='#00dcff',width=2)
        draw.text((x,y-25),f'{n}: {r["profile_id"]}; old {old}, unmarked' if args.no_markers else f'{n}: {r["profile_id"]}; old {old}, cyan zero if None',fill='white')
    out.save(QA/f'{args.group}-{args.tag}-{start:03}.png')
print('Saved native context',args.group,len(indices),flush=True)
