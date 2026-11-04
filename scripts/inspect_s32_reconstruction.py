"""Inspección documental reproducible de S32; no transforma coordenadas."""
import argparse
import csv
import hashlib
import json
import math
import re
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = 'e1320e9968f994d956f51a3ccb0602a864cc4d5929d42a4ef555b7fb18691a05'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pdf', type=Path, required=True)
args = parser.parse_args()
raw = args.pdf.read_bytes()
if hashlib.sha256(raw).hexdigest() != EXPECTED:
    raise SystemExit('El PDF no coincide con el original S32 auditado.')
doc = pymupdf.open(stream=raw, filetype='pdf')
table = doc[77].get_text()
matches = re.findall(r'\b([ABC][1-5])\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)', table)
if len(matches) != 15 or len({x[0] for x in matches}) != 15:
    raise SystemExit('La tabla no contiene los 15 sitios únicos esperados.')
out = ROOT / 'scientific' / 'catalogue'
out.mkdir(parents=True, exist_ok=True)
target = out / 's32-reference-sites.csv'
with target.open('w', newline='', encoding='utf-8-sig') as f:
    w = csv.writer(f)
    w.writerow(['site_id','easting_m','northing_m','orthometric_height_m','datum_as_printed','utm_zone','coordinate_epoch','measurement_date','role','source_id','printed_page','pdf_page','map_status'])
    for site,east,north,height in matches:
        w.writerow([site,east,north,height,'WGS84','no_explicitada_en_tabla','no_establecida','no_establecida_por_sitio','referencia_de_perfil_no_limite','S32',64,78,'no_integrado'])
keys = []
for i in range(1, doc.xref_length()):
    obj = doc.xref_object(i)
    for key in ('/LGIDict', '/GPTS', '/GCS', '/VP', '/EmbeddedFiles'):
        if key in obj:
            keys.append({'xref':i, 'key':key})
positions = {s:(float(e),float(n)) for s,e,n,h in matches}
distances = [{'from':f'B{i}', 'to':f'B{i+1}',
              'planar_distance_m':round(math.dist(positions[f'B{i}'],positions[f'B{i+1}']),3)} for i in range(1,5)]
report = {
    'source_id':'S32', 'reviewed_on':'2026-09-09',
    'source_bytes':len(raw), 'source_sha256':EXPECTED, 'pdf_pages':len(doc),
    'embedded_files':doc.embfile_names(), 'searched_keys':['/LGIDict','/GPTS','/GCS','/VP','/EmbeddedFiles'],
    'key_hits':keys, 'figure_page':72,
    'drawing_objects_on_whole_page':len(doc[71].get_drawings()),
    'drawing_warning':'Objetos gráficos de página, no entidades GIS ni conteo de subceldas.',
    'sites_extracted':len(matches), 'table_pdf_page':78,
    'figure_control_point_pairs_verified':0,
    'georeferencing_rmse_m':None,
    'rmse_reason':'No hay pares de control verificados; no se ajustó una transformación.',
    'B_adjacent_distances':distances,
    'distance_warning':'Cálculo plano sobre coordenadas publicadas; no corrige el texto ni valida posiciones.',
    'output_csv_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
    'software':{'pymupdf':pymupdf.VersionBind},
    'decision':'documentary_reference_only_pending_control_points_and_reuse_conditions'
}
(out/'s32-reconstruction-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
if hashlib.sha256(args.pdf.read_bytes()).hexdigest() != EXPECTED:
    raise SystemExit('El original cambió durante la inspección.')
print(json.dumps(report,ensure_ascii=False,indent=2))
