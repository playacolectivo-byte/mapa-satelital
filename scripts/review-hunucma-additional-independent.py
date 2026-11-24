"""Prepare source-centred images for the independent 394-reading Hunucma pass."""
from pathlib import Path
import hashlib,json
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/hunucma-additional-review-20261106';OUT=ROOT/'work/dzemul-audit-20261105/hunucma-additional-independent';OUT.mkdir(parents=True,exist_ok=True);path=QA/'approved-additional.json';raw=path.read_bytes();data=json.loads(raw);sources={s['id']:s for s in data['sources']};images={};annotated=[]
for r in data['states']:
 if not isinstance(r.get('visual_choice'),(int,float)):continue
 source=sources[r['source_id']];panel=ROOT/source['panel']
 if panel not in images:images[panel]=Image.open(panel).convert('RGB');assert hashlib.sha256(panel.read_bytes()).hexdigest()==source['screenshot_sha256']
 x,y=source['panel_pixel'];strip=images[panel].crop((round(x)-39,round(y)-48,round(x)+41,round(y)+49));annotated.append((r,source,strip))
for start in range(0,len(annotated),20):
 selected=annotated[start:start+20];im=Image.new('RGB',(80*len(selected),166),'#142a30');draw=ImageDraw.Draw(im)
 for j,(r,s,strip)in enumerate(selected):
  x=j*80;draw.text((x,0),str(r['display_index'])+' '+r['profile_id'].replace('SC-','').replace('-0-','-'),fill='white');draw.text((x,12),r['date'][2:],fill='white');draw.text((x,24),str(s['release'])+' '+str(r['proposed_offset_m']),fill='#ff9020');im.paste(strip,(x,40));draw.line((x+39,40,x+39,136),fill='#cccc00');draw.line((x+2,88,x+10,88),fill='#ff9020',width=2);draw.line((x+69,88,x+77,88),fill='#ff9020',width=2)
 draw.text((4,142),'Final proposed apparent contact at y88; native-derived +/-24m context. 16px=8m; source approval is separate.',fill='white');im.save(OUT/f'cross-{start:03}.png')
(OUT/'input.json').write_text(json.dumps({'source_package_sha256':hashlib.sha256(raw).hexdigest(),'expected':394,'annotated':len(annotated),'records':[{'state':r,'source':s,'cross_panel':f'cross-{n//20*20:03}.png'}for n,(r,s,im)in enumerate(annotated)],'all_states':data['states']},indent=2)+'\n',encoding='utf-8');print({'annotated':len(annotated),'panels':(len(annotated)+19)//20,'pending_visual':[{'index':r['display_index'],'profile_id':r['profile_id'],'status':r['status'],'panel':r['evidence_panel']}for r in data['states']if not isinstance(r.get('visual_choice'),(int,float))]})
