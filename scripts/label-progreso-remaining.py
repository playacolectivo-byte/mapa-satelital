"""Improve cell separation for still-unreviewed remaining source panels."""
from pathlib import Path
import hashlib,json
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'work/progreso-remaining-review-20261105';path=OUT/'remaining-proposals.json';data=json.loads(path.read_text(encoding='utf-8'));rows=data['rows']
for start in range(432,len(rows),24):
 panel=OUT/f'remaining-{start:04}.png';im=Image.open(panel).convert('RGB');draw=ImageDraw.Draw(im);draw.rectangle((32,0,im.width,47),fill='#142a30')
 for j,r in enumerate(rows[start:start+24]):
  x=32+j*64;draw.text((x,0),str(j)+':'+r['profile_id'].replace('SC-','').replace('-0-','-'),fill='white');draw.text((x,11),r['date'][2:],fill='white');draw.text((x,22),str(start+j)+' c'+str(r['capture']),fill='white');b=round(r['baseline_offset_m'],1);o=r['previous']['offset_m'];o='?'if o is None else str(round(o,1));draw.text((x,33),str(b)+'/'+o,fill='#22ccff');draw.line((x,48,x,248),fill='#142a30',width=2)
 im.save(panel);sha=hashlib.sha256(panel.read_bytes()).hexdigest()
 for r in rows[start:start+24]:r['evidence_panel_sha256']=sha
temporary=path.with_suffix('.json.tmp');temporary.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8');temporary.replace(path)
print('Labelled future panels without changing their sampling geometry or pixel y.',flush=True)
