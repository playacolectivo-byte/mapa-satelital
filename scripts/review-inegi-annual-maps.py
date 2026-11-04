"""Bounded display QA of the official annual INEGI WMS; no scientific measurements."""
from pathlib import Path
import concurrent.futures
import datetime
import hashlib
import io
import json
import time
import urllib.parse
import urllib.request
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'work/2026-10-28-historico-integrado/inegi-annual-review'
OUT.mkdir(parents=True, exist_ok=True)
BOUNDS = [-90.55, 20.65, -87.15, 22]
URL = 'https://mapas.inegi.org.mx/geoserver/Sitio_Inegi/wms'
places = json.loads((ROOT / 'public/data/coastal-places.json').read_text())
places = places['places']

def review(year):
    params = dict(service='WMS', version='1.1.1', request='GetMap',
        layers=f'Sitio_Inegi:gm_colornatural_{year}', styles='', srs='EPSG:4326',
        bbox=','.join(map(str, BOUNDS)), width=1000, height=430,
        format='image/png', transparent='true')
    url = URL + '?' + urllib.parse.urlencode(params)
    path = OUT / f'{year}.png'
    result = dict(year=year, layer=params['layers'], url=url, bounds=BOUNDS,
        reviewed_on=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        purpose='visual map coverage QA only; not waterline measurement',
        native_pixels_exhaustively_reviewed=False)
    try:
        if path.exists():
            raw = path.read_bytes()
            headers = json.loads(path.with_suffix('.headers.json').read_text())
        else:
            with urllib.request.urlopen(url, timeout=40) as response:
                raw = response.read(5_000_001)
                headers = dict(response.headers)
                result['http_status'] = response.status
            if len(raw) > 5_000_000: raise ValueError('display QA response exceeds budget')
            path.write_bytes(raw)
            path.with_suffix('.headers.json').write_text(json.dumps(headers, indent=2))
        im = Image.open(io.BytesIO(raw)).convert('RGBA')
        if im.size != (1000,430): raise ValueError('wrong image dimensions')
        rgb = im.convert('RGB')
        extrema = rgb.getextrema()
        if all(lo == hi for lo,hi in extrema): raise ValueError('uniform image')
        samples = []
        for place in places:
            lon,lat = place['coordinates']
            x = round((lon-BOUNDS[0])/(BOUNDS[2]-BOUNDS[0])*999)
            y = round((BOUNDS[3]-lat)/(BOUNDS[3]-BOUNDS[1])*429)
            patch = im.crop((x-2,y-2,x+3,y+3))
            pixels = list(patch.getdata())
            samples.append(dict(name=place['name'],municipality=place['municipality'],
                coordinates=[lon,lat], opaque_pixels=sum(p[3]>0 for p in pixels),
                dark_pixels=sum(max(p[:3])<5 for p in pixels),pixels=len(pixels)))
        result.update(ok=True, bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(),
            cors=headers.get('Access-Control-Allow-Origin',headers.get('access-control-allow-origin')),
            image_size=list(im.size), locality_samples=samples,
            all_locality_samples_visible=all(s['opaque_pixels']>0 and s['dark_pixels']<s['pixels'] for s in samples))
    except Exception as exc:
        result.update(ok=False,error=f'{type(exc).__name__}: {exc}')
    path.with_suffix('.review.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps({k:result.get(k) for k in ['year','ok','bytes','all_locality_samples_visible','error']}),flush=True)
    return result

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(review, range(1993,2026)))

summary = dict(source=URL, bounds=BOUNDS, years=results,
    warning='Overview images and locality samples validate map availability, not every native pixel or scientific fitness.')
(OUT / 'review.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
sheet = Image.new('RGB',(5*240,7*135),'white')
draw = ImageDraw.Draw(sheet)
for i,r in enumerate(results):
    x,y=(i%5)*240,(i//5)*135
    draw.text((x+4,y+4),str(r['year']),fill='black')
    if r['ok']:
        im=Image.open(OUT/f"{r['year']}.png").convert('RGB')
        im.thumbnail((232,110))
        sheet.paste(im,(x+4,y+20))
sheet.save(OUT/'contact-sheet.jpg',quality=85)
print('DONE',len(results),sum(r['ok'] for r in results),flush=True)
