"""Explicit visual choices on the native 2D photographs; no classifier."""
from pathlib import Path
import json,hashlib
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'work/chicxulub-reference-review-20261106/east'
data=json.loads((BASE/'inventory.json').read_text(encoding='utf-8'))
# Y coordinates in the stored 1.5x-native panels, chosen at the water-facing
# sand/water contact rather than the inner beach or vegetation/building edge.
ys=[194,193,194,535,537,538,194,193,191,539,540,534,194,194,194,536,517,536,190,191,185,534,537,535,192,193,193,539,539,538,193,191,194,538,539,539,192,191,193]
assert len(ys)==len(data['rows'])
decisions=[];panels={}
for r,y in zip(data['rows'],ys):
 cell=r['panel_cell'];panel_y=(cell//3)*345+46
 old_y=panel_y+(r['old_pixel'][1]-r['pixel_origin'][1])*1.5
 offset=round(r['current_offset_m']+(old_y-y)*r['mpp']/(1.5*r['v'][1]),1)
 scale=(offset-r['current_offset_m'])/r['mpp']
 x=(cell%3)*384+1.5*(r['old_pixel'][0]-r['pixel_origin'][0]+r['v'][0]*scale)
 yy=panel_y+1.5*(r['old_pixel'][1]-r['pixel_origin'][1]-r['v'][1]*scale)
 panel=panels.setdefault(r['panel'],Image.open(ROOT/r['panel']).convert('RGB'));draw=ImageDraw.Draw(panel);draw.ellipse((x-4,yy-4,x+4,yy+4),outline='#ff8d29',width=2)
 decisions.append({**r,'offset_m':offset,'chosen_screen_y':y,'old_screen_y':old_y,'decision':'manual_water_facing_sand_sea_contact_native_2d','reviewer':'root','manual_uncertainty_m':8})
for path,panel in panels.items():panel.save(BASE/(Path(path).stem+'-root-decisions.png'))
(BASE/'root-decisions.json').write_text(json.dumps({'status':'proposed_for_independent_visual_review','source_photos_sha256':data['photos_sha256'],'records':decisions},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'reviewed':len(decisions),'maximum_shift_m':max(abs(r['offset_m']-r['current_offset_m']) for r in decisions)}))
