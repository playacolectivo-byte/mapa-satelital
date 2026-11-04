#!/usr/bin/env python3
"""Portable processing subset. No Git identity, secrets or satellite pixels."""
import argparse,hashlib,json,zipfile
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
FILES=[
 'scientific/coverage-extension/resume_downloads.py',
 'scientific/coverage-extension/INICIAR_DESCARGAS.command',
 'scientific/coverage-extension/README.md',
 'scientific/coverage-extension/incoming/chelem-progreso/plan.json',
 'scientific/coverage-extension/incoming/chelem-progreso/scope.json',
 'scientific/coverage-extension/incoming/regional-landsat/plan.json',
 'scientific/coverage-extension/incoming/regional-landsat/scope.json',
 'scientific/annual-waterlines/process.py',
 'scientific/annual-waterlines/requirements.txt',
 'scientific/annual-waterlines/result-summary.json',
 'scientific/annual-waterlines/execution-status.json',
 'scientific/annual-waterlines/inventories/landsat-1986-2020-12-31-183200.json.gz',
 'scientific/annual-waterlines/inventories/sentinel-2015-2026-10-27-183233.json.gz',
 'scientific/baseline-1986/process.py',
 'scientific/pilot-1c/sentinel_public.py',
 'public/data/problems/s34-l5.geojson','public/data/problems/s34-l8.geojson','public/data/problems/s34-s2.geojson',
]
def sha(b):return hashlib.sha256(b).hexdigest()

def main():
 p=argparse.ArgumentParser();p.add_argument('output');args=p.parse_args()
 prefix='Datos_satelitales_1986_2026/'
 files={name:(ROOT/name).read_bytes() for name in FILES}
 files['INICIAR_DESCARGAS.command']=(ROOT/'scientific/coverage-extension/KIT_INICIAR_DESCARGAS.command').read_bytes()
 files['LEEME_PRIMERO.txt']=('Este paquete contiene el descargador y los catálogos; las imágenes se descargan al ejecutarlo.\n'
  'No se ha escrito nada en tu computadora desde el chat.\n\n'
  '1. Extrae el ZIP dentro de tu carpeta existente «restauracion litoral».\n'
  '   Se crea la subcarpeta Datos_satelitales_1986_2026 sin cambiar otros archivos.\n'
  '2. En Terminal, entra en esa subcarpeta y ejecuta: bash INICIAR_DESCARGAS.command\n'
  '   Se necesita Python 3.11–3.13; el programa indica si falta.\n'
  '3. Las imágenes, recibos y candidatos quedan dentro de esa misma subcarpeta.\n'
  '   Los resultados requieren revisión antes de incorporarlos al mapa.\n\n'
  'Instrucciones completas: scientific/coverage-extension/README.md\n'
  'No publica nada, no solicita contraseñas y no cambia permisos ni protecciones de red.\n').encode()
 manifest={'created_at':datetime.now(timezone.utc).isoformat(),'continues_commit':'5624d2fce5c670f73eaca2db3b0d6b5afb9ac50c',
  'satellite_pixels_included':False,'download_catalogue_candidates':1233,
  'downloads_executed_from_chat':False,'files':[{'path':n,'bytes':len(b),'sha256':sha(b)} for n,b in files.items()]}
 files['MANIFIESTO_PAQUETE.json']=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode()
 out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for name,data in files.items():
   info=zipfile.ZipInfo(prefix+name,date_time=(2026,10,27,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
   info.external_attr=((0o100755 if name.endswith('.command') else 0o100644)<<16)
   z.writestr(info,data)
 with zipfile.ZipFile(out) as z:
  assert z.testzip() is None
  for name,data in files.items():assert z.read(prefix+name)==data
  assert all(n.startswith(prefix) and '..' not in Path(n).parts for n in z.namelist())
 report={'file':str(out),'bytes':out.stat().st_size,'sha256':sha(out.read_bytes()),'files':len(files),
  'root_folder':prefix.rstrip('/'),'all_entry_hashes_and_crc_passed':True,
  'satellite_pixels_included':False,'laptop_downloads_verified':False}
 (ROOT/'docs/qa/satellite-downloader-package-2026-10-27.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report))
if __name__=='__main__':main()
