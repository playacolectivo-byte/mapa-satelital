"""Verifica ZIP públicos INEGI y conserva metadatos; no modifica rásteres."""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--originals', type=Path, required=True)
parser.add_argument('--verify', action='store_true', help='Comprobar contra el manifiesto existente sin reescribir archivos')
args = parser.parse_args()
out = ROOT/'scientific/catalogue/historical-bases'
if args.verify:
    manifest = json.loads((out/'manifest.json').read_text())
    for record in manifest['records']:
        p = args.originals/record['external_original']
        raw = p.read_bytes()
        if len(raw) != record['zip_bytes'] or hashlib.sha256(raw).hexdigest() != record['zip_sha256']:
            raise SystemExit('Original distinto al manifiesto: '+p.name)
        with zipfile.ZipFile(p) as z:
            if z.testzip() is not None:
                raise SystemExit('CRC incorrecto: '+p.name)
            for member in record['members']:
                raw = z.read(member['zip_path'])
                if len(raw) != member['bytes'] or hashlib.sha256(raw).hexdigest() != member['sha256']:
                    raise SystemExit('Miembro distinto: '+member['zip_path'])
                if member['included_metadata_copy']:
                    if (ROOT/member['included_metadata_copy']).read_bytes() != raw:
                        raise SystemExit('Copia de metadatos distinta: '+member['zip_path'])
    print('Verificación aprobada contra manifiesto: originales, miembros ZIP y copias de metadatos.')
    raise SystemExit(0)
out.mkdir(parents=True, exist_ok=True)
records = []
for upc in ['889463456759','889463456766']:
    p = args.originals/f'{upc}_b.zip'
    digest = hashlib.sha256(p.read_bytes()).hexdigest()
    with zipfile.ZipFile(p) as z:
        if z.testzip() is not None:
            raise ValueError('ZIP corrupto: '+p.name)
        names = z.namelist()
        bil = next(n for n in names if n.endswith('.bil'))
        stem = Path(bil).stem
        hdr = dict(line.split() for line in z.read(stem+'.hdr').decode().splitlines() if line.strip())
        expected = int(hdr['NROWS'])*int(hdr['NCOLS'])*int(hdr['NBANDS'])*int(hdr['NBITS'])//8
        assert z.getinfo(bil).file_size == expected
        metadata = ET.fromstring(z.read(stem+'_met.xml'))
        members=[]
        for n in names:
            raw=z.read(n)
            copied=None
            if not n.endswith('.bil'):
                target=out/upc/Path(n).name
                target.parent.mkdir(parents=True,exist_ok=True)
                target.write_bytes(raw)
                copied=str(target.relative_to(ROOT))
            members.append({'zip_path':n,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'included_metadata_copy':copied})
        records.append({'upc':upc,'sheet':stem.upper(),'retrieved_on':'2026-09-09',
          'source_url':f'https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/bvinegi/productos/geografia/ortofoto_1_20/{upc}_b.zip',
          'catalogue_url':f'https://www.inegi.org.mx/app/biblioteca/ficha.html?upc={upc}',
          'external_original':p.name,'zip_bytes':p.stat().st_size,'zip_sha256':digest,'zip_crc_ok':True,
          'raster_bytes_match_header':True,'header':hdr,'projection_as_delivered':z.read(stem+'.prj').decode().strip(),
          'members':members,'source_match_to_S32':'compatible_candidate_not_proven_exact_input',
          'map_integration':'not_integrated','control_points_verified':0})
    assert hashlib.sha256(p.read_bytes()).hexdigest()==digest
(out/'manifest.json').write_text(json.dumps({'schema_version':1,'records':records},ensure_ascii=False,indent=2)+'\n')
print('Dos ZIP íntegros; cabeceras y tamaños BIL comprobados; metadatos conservados con SHA-256.')
