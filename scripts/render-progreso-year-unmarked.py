"""Raw dated strips centred on prior candidates for visual checking, no classifier acceptance."""
from pathlib import Path
import argparse,json
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/progreso-year-review-20261105';parser=argparse.ArgumentParser();parser.add_argument('--group',default='latest');args=parser.parse_args()
rows=json.loads((QA/f'{args.group}-proposals.json').read_text(encoding='utf-8'))['rows'];samples=np.load(ROOT/'work/progreso-full-review-20261105/all-dates-samples.npz')['samples']
for start in range(0,len(rows),14):
    out=Image.new('RGB',(1120,290),'#142a30');draw=ImageDraw.Draw(out)
    for j,r in enumerate(rows[start:start+14]):
        old=r['previous']['offset_m'];centre=int(round((150-(old or 0))*2));strip=Image.fromarray(samples[r['source_index']]).crop((0,centre-100,31,centre+100)).resize((80,200),Image.Resampling.NEAREST);x=j*80;out.paste(strip,(x,65));draw.text((x+2,3),str(start+j)+': '+r['profile_id'].replace('SC-',''),fill='white');draw.text((x+2,23),f'old {old}m',fill='white');draw.line((x,165,x+10,165),fill='#00dcff',width=2);draw.line((x+69,165,x+79,165),fill='#00dcff',width=2)
    draw.text((3,273),'Unmarked raw strips about old cyan position (zero if missing); cyan side ticks only. .5m/display pixel.',fill='white');out.save(QA/f'{args.group}-normalized-{start:03}.png')
print('Rendered unmarked',args.group,len(rows),flush=True)
