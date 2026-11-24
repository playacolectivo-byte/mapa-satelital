"""Overlay existing detector positions for visual review; never approve readings."""
from pathlib import Path
import argparse,json
from PIL import Image,ImageDraw
parser=argparse.ArgumentParser();parser.add_argument('--release',required=True,type=int);args=parser.parse_args()
root=Path(__file__).resolve().parents[1];folder=root/f'work/hunucma-audit-20261105/release-{args.release}'
manifest=json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
photos=json.loads((root/'public/data/municipalities/hunucma/photos.json').read_text(encoding='utf-8'));targets={t['id']:t for t in photos['targets']}
records=[]
for start in range(0,len(manifest['profiles']),14):
 image=Image.open(folder/f'profiles-{start:03}.png').convert('RGB');draw=ImageDraw.Draw(image)
 for j,target in enumerate(manifest['profiles'][start:start+14]):
  reading=next(r for r in targets[target['id']]['readings'] if args.release in r['releases'])
  records.append({'index':start+j,'profile_id':target['id'],'capture':reading['capture'],'date':photos['captures'][reading['capture']]['date'],'offset_m':reading['offset_m'],'accepted':reading['accepted'],'panel':f'existing-{start:03}.png'})
  if reading['offset_m'] is None:continue
  y=340-reading['offset_m']*2
  draw.line((j*80+8,y,j*80+71,y),fill='#34ff44' if reading['accepted'] else '#ff9630',width=2)
 image.save(folder/f'existing-{start:03}.png')
(folder/'existing-readings.json').write_text(json.dumps(records,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'existing_readings':len(records),'previously_accepted':sum(r['accepted'] for r in records),'release':args.release}))
