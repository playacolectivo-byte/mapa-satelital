"""Render dated Progreso strips for explicit visual decisions; never auto-accept a model."""
from pathlib import Path
import argparse,hashlib,json
import numpy as np
from scipy.ndimage import gaussian_filter1d,uniform_filter
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];QA=ROOT/'work/progreso-full-review-20261105';OUT=ROOT/'work/progreso-year-review-20261105';OUT.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('--group',choices=['2015','latest','all','baseline-gap'],default='2015');args=parser.parse_args()
inventory_path=QA/'all-dates-inventory.json';sample_path=QA/'all-dates-samples.npz'
inventory=json.loads(inventory_path.read_text(encoding='utf-8'));records=inventory['records'];data=np.load(sample_path);samples=data['samples'];offsets=data['offsets'];models=np.load(QA/'rgb-proposal-model.npz')
def propose(im):
    a=im.astype('float32')/255;mu=uniform_filter(a,size=(15,7,1));sd=np.sqrt(np.maximum(0,uniform_filter(a*a,size=(15,7,1))-mu*mu));x=np.concatenate([a,mu,sd],axis=2);scores=[]
    for j in [0,1]:
        d=x-models[f'mean_{j}'];scores.append(-.5*(np.einsum('...i,ij,...j->...',d,models[f'inverse_{j}'],d)+models[f'logdet_{j}']))
    probability=1/(1+np.exp(np.clip(scores[0]-scores[1],-50,50)));curve=gaussian_filter1d(np.median(probability,axis=1),3);indices=np.where((curve[:-1]>=.5)&(curve[1:]<.5))[0];candidates=[]
    for i in indices:
        if i<30 or i>len(offsets)-30:continue
        contrast=float(curve[i-30:i].mean()-curve[i+1:i+31].mean())
        if contrast>.35:candidates.append({'offset_m':round(float(offsets[i]+(offsets[i+1]-offsets[i])*(curve[i]-.5)/(curve[i]-curve[i+1])),1),'contrast':contrast})
    return sorted(candidates,key=lambda c:-c['contrast'])
if args.group=='2015':indices=[i for i,r in enumerate(records) if r['date'].startswith('2015')]
elif args.group=='baseline-gap':indices=[i for i,r in enumerate(records) if r['capture']==40 and r['profile_id'] in {'SC-88-0-20','SC-88-0-21','SC-88-0-22','SC-88-0-23'}]
elif args.group=='latest':
    latest={}
    for i,r in enumerate(records):
        old=latest.get(r['profile_id'])
        if old is None or r['date']>records[old]['date']:latest[r['profile_id']]=i
    indices=list(latest.values())
else:indices=list(range(len(records)))
indices.sort(key=lambda i:(records[i]['date'] if args.group=='all' else '',records[i]['p'][0],records[i]['p'][1]))
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',11);rows=[]
for start in range(0,len(indices),14):
    panel=Image.new('RGB',(1164,700),'#142a30');draw=ImageDraw.Draw(panel)
    for j,i in enumerate(indices[start:start+14]):
        r=records[i];candidates=propose(samples[i]);x=44+j*80
        panel.paste(Image.fromarray(samples[i]).resize((80,601)),(x,45))
        draw.text((x+2,1),r['profile_id'].replace('SC-',''),font=font,fill='white');draw.text((x+2,15),r['date'],font=font,fill='white');draw.text((x+2,29),f'{start+j} / {r["release"]}',font=font,fill='white')
        old=r['previous']['offset_m']
        if old is not None:
            y=45+2*(150-old);draw.line((x+5,y,x+74,y),fill='#00dcff',width=2)
        if candidates:
            y=45+2*(150-candidates[0]['offset_m']);draw.line((x+16,y,x+63,y),fill='#ff384c',width=2)
        draw.line((x+40,45,x+40,646),fill='#ddc748')
        rows.append({'display_index':start+j,'source_index':i,'profile_id':r['profile_id'],'capture':r['capture'],'date':r['date'],'release':r['release'],'source':r['source'],'p':r['p'],'v':r['v'],'previous':r['previous'],'candidates':candidates,'panel':start})
    for off in range(-140,151,20):
        y=45+2*(150-off);draw.text((2,y-6),str(off),font=font,fill='white');draw.line((44,y,1164,y),fill='#315359')
    draw.text((44,658),f'{args.group}: raw dated tiles z17; cyan=previous; red=UNAPPROVED colour proposal; positive sea, negative land. y=45+2*(150-offset_m)',font=font,fill='white')
    draw.text((44,675),'Photo acquisition date is printed per strip; official metadata at each corrected endpoint still requires verification.',font=font,fill='white')
    path=OUT/f'{args.group}-{start:03}.png';panel.save(path)
    for row in rows[-len(indices[start:start+14]):]:row.update(evidence_panel=str(path.relative_to(ROOT)),evidence_panel_sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    print(f'Rendered {args.group} {start+len(indices[start:start+14])}/{len(indices)}',flush=True)
result={'group':args.group,'status':'unapproved_visual_proposals','source_inventory_sha256':hashlib.sha256(inventory_path.read_bytes()).hexdigest(),'source_samples_sha256':hashlib.sha256(sample_path.read_bytes()).hexdigest(),'rows':rows}
(OUT/f'{args.group}-proposals.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('Completed',args.group,len(rows),flush=True)
