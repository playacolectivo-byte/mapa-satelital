"""Render chosen positions separately for the second independent visual review."""
from pathlib import Path
import argparse,csv,hashlib,json
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/progreso-year-review-20261105';parser=argparse.ArgumentParser();parser.add_argument('--group',default='latest');args=parser.parse_args()
review=json.loads((QA/f'{args.group}-decisions.json').read_text(encoding='utf-8'));chosen={r['display_index']:r for r in review['reviewed_readings']};pending={r['display_index']:r for r in review['pending']};proposals=json.loads((QA/f'{args.group}-proposals.json').read_text(encoding='utf-8'))['rows'];evidence=[]
for start in range(0,len(proposals),14):
    path=QA/f'{args.group}-{start:03}.png';panel=Image.open(path).convert('RGB');draw=ImageDraw.Draw(panel)
    for n in range(start,min(start+14,len(proposals))):
        x=44+(n-start)*80
        if n in chosen:
            y=45+2*(150-chosen[n]['offset_m']);draw.line((x+5,y,x+74,y),fill='#ff9020',width=2)
        elif n in pending:draw.text((x+3,642),'PENDING',fill='#ffb000')
    draw.rectangle((44,655,1164,700),fill='#142a30');draw.text((44,658),'ORANGE = explicit visually chosen boundary; cyan = previous; red = unapproved model. PENDING remains unapproved.',fill='white');dest=QA/f'{args.group}-reviewed-{start:03}.png';panel.save(dest);evidence.append({'panel':str(dest.relative_to(ROOT)),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
(QA/f'{args.group}-second-pass-evidence.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
with (QA/f'{args.group}-chosen-offsets.csv').open('w',encoding='utf-8',newline='') as f:
    columns=['display_index','profile_id','capture','date','release','offset_m','decision','evidence_panel','evidence_panel_sha256'];w=csv.DictWriter(f,fieldnames=columns,extrasaction='ignore');w.writeheader();w.writerows(review['reviewed_readings'])
print('Rendered second-pass evidence',args.group,len(evidence),'panels',flush=True)
