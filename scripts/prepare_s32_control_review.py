"""Prepara recortes de inspección reproducibles; no ajusta ni transforma geometrías."""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path
import numpy as np
import pymupdf

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pdf', type=Path, required=True)
parser.add_argument('--ortho', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
expected = {
    'pdf':'e1320e9968f994d956f51a3ccb0602a864cc4d5929d42a4ef555b7fb18691a05',
    'ortho':'d5f5bdea4457cf280c77186c35c56006a564c9d67c205649ff0823fabe9bb138',
}
for key in expected:
    if hashlib.sha256(getattr(args,key).read_bytes()).hexdigest() != expected[key]:
        raise SystemExit('Entrada distinta de la revisada: '+key)
args.output.mkdir(parents=True,exist_ok=True)
page=pymupdf.open(args.pdf)
clip=[80,170,470,345]
page[71].get_pixmap(matrix=pymupdf.Matrix(3,3),clip=pymupdf.Rect(*clip)).save(args.output/'figure12_detail.png')
artifacts=[{'file':'figure12_detail.png','source':'S32','pdf_page_one_based':72,'clip_pdf_points':clip,'render_scale':3}]
with zipfile.ZipFile(args.ortho) as z:
    if z.testzip() is not None:
        raise SystemExit('ZIP no íntegro')
    h=dict(line.split() for line in z.read('f16c31e.hdr').decode().splitlines() if line.strip())
    a=np.frombuffer(z.read('f16c31e.bil'),dtype=np.uint8).reshape(int(h['NROWS']),int(h['NCOLS']))
    for i,(x0,x1) in enumerate([(1900,3300),(3300,4650),(4600,5950)]):
        y0,y1=3300,4189
        crop=np.ascontiguousarray(a[y0:y1,x0:x1])
        name=f'coast_detail_{i}.png'
        pymupdf.Pixmap(pymupdf.csGRAY,crop.shape[1],crop.shape[0],crop.tobytes(),False).save(args.output/name)
        artifacts.append({'file':name,'source':'INEGI-889463456759','zip_member':'f16c31e.bil',
          'column_start_zero_based':x0,'column_end_exclusive':x1,'row_start_zero_based':y0,'row_end_exclusive':y1,
          'resampling':'none','contrast_adjustment':'none','pixel_size_m':2})
for item in artifacts:
    item['sha256']=hashlib.sha256((args.output/item['file']).read_bytes()).hexdigest()
manifest={'sources_sha256':expected,'artifacts':artifacts,
    'coordinate_note':'Las coordenadas de recorte son píxeles o puntos PDF, no pares de control geográficos.',
    'software':{'numpy':np.__version__,'pymupdf':pymupdf.VersionBind}}
(args.output/'inspection-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
for key in expected:
    assert hashlib.sha256(getattr(args,key).read_bytes()).hexdigest()==expected[key]
print('Cuatro vistas de inspección y manifiesto generados; originales conservados; sin ajuste espacial.')
