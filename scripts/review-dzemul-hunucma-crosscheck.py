"""Prepare independent visual strips centred on Hunucma-approved readings.

Writes only separate QA; never changes the Hunucma scientific overlay.
"""
from pathlib import Path
import hashlib,json
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'work/dzemul-audit-20261105/hunucma-independent';OUT.mkdir(parents=True,exist_ok=True)
path=ROOT/'public/data/shorelines/photo-alignment/manual-hunucma-20261105.json';raw=path.read_bytes();data=json.loads(raw);rows=data['reviewed_readings'];assert len(rows)==795
manifests={};images={};audit=[]
for n,r in enumerate(rows):
 panel=ROOT/r['panel'];release=r['releases'][0]
 if release not in manifests:manifests[release]=json.loads((panel.parent/'manifest.json').read_text(encoding='utf-8'))
 profiles=manifests[release]['profiles'];index=next(i for i,t in enumerate(profiles)if t['id']==r['profile_id']);assert panel.name==f'existing-{index//14*14:03}.png'
 if panel not in images:images[panel]=Image.open(panel).convert('RGB');assert hashlib.sha256(panel.read_bytes()).hexdigest()==r['panel_sha256']
 im=images[panel];x=index%14*80;y=round(340-2*r['offset_m']);assert 40<=y<=640,(r,y)
 strip=im.crop((x,y-48,x+80,y+49));audit.append({**r,'index':n,'source_pixel':[x+39.5,y],'crop_relative_m':[-24,24],'cross_review_status':'pending'})
 if n%20==0:combined=Image.new('RGB',(min(20,len(rows)-n)*80,164),'#172b30');draw=ImageDraw.Draw(combined)
 j=n%20;combined.paste(strip,(j*80,40));draw.text((j*80+2,0),r['profile_id'].replace('SC-',''),fill='white');draw.text((j*80+2,12),r['date'][2:],fill='white');draw.text((j*80+2,24),str(release),fill='white');draw.line((j*80+39,40,j*80+39,136),fill='#cccc00');draw.line((j*80+2,88,j*80+10,88),fill='#ff9020',width=2);draw.line((j*80+69,88,j*80+77,88),fill='#ff9020',width=2)
 if j==19 or n==len(rows)-1:
  draw.text((4,141),'Green reading at y88; visible sand/water contact must be within +/-16px (8m tolerance). Source z17.',fill='white');combined.save(OUT/f'cross-{n//20*20:03}.png')
(OUT/'input.json').write_text(json.dumps({'source_overlay_sha256':hashlib.sha256(raw).hexdigest(),'count':len(rows),'readings':audit},indent=2)+'\n',encoding='utf-8');print({'readings':len(rows),'panels':(len(rows)+19)//20})
