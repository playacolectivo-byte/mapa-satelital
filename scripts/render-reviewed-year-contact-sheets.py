"""Make transparent visual crosscheck sheets from explicit dated decisions."""
from pathlib import Path
import argparse,collections,hashlib,json
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--year',type=int,default=2015);parser.add_argument('--group');args=parser.parse_args()
review=json.loads((ROOT/'work/progreso-year-review-20261105/approved-years.json').read_text(encoding='utf-8'));dest=ROOT/'work/progreso-year-review-20261105/root-crosscheck';dest.mkdir(exist_ok=True)
sources=[s for s in review['sources'] if s['id'].startswith('progreso-'+args.group+'-')] if args.group else [s for s in review['sources'] if s['capture_date'].startswith(str(args.year))];groups=collections.defaultdict(list)
for s in sources:groups[s['panel']].append(s)
panels=[]
for path,rows in sorted(groups.items()):
 image=Image.open(ROOT/path).convert('RGB');draw=ImageDraw.Draw(image)
 for row in rows:
  x,y=row['panel_pixel'];draw.line((x-34,y,x+34,y),fill='#ff9020',width=2)
 out=dest/Path(path).name;image.save(out);panels.append((out,max(45,int(min(r['panel_pixel'][1] for r in rows))-60),min(646,int(max(r['panel_pixel'][1] for r in rows))+60)))
for start in range(0,len(panels),4):
 subset=panels[start:start+4];out=Image.new('RGB',(1164,sum(hi-lo+22 for _,lo,hi in subset)),'#142a30');draw=ImageDraw.Draw(out);y=0
 for p,lo,hi in subset:
  out.paste(Image.open(p).crop((0,lo,1164,hi)),(0,y+22));draw.text((8,y+4),'Root independent '+str(args.group or args.year)+' '+p.name+'; orange: reviewed choice',fill='white');y+=hi-lo+22
 out.save(dest/f'contact-{args.group or args.year}-{start//4:02}.png')
print(json.dumps({'sources':len(sources),'panels':len(panels),'contacts':len(range(0,len(panels),4))}),flush=True)
