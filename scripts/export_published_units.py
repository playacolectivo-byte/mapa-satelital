"""Exporta el inventario documental; no genera geometrías ni modifica originales."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'scientific' / 'catalogue'
data = json.loads((BASE / 'published-units.json').read_text())
sources = {s['id']: s for s in data['sources']}
records = data['records']
assert len(sources) == len(data['sources']), 'Fuentes duplicadas'
assert len({r['id'] for r in records}) == len(records), 'IDs duplicados'
fields = ['id', 'label', 'type', 'source_id', 'publication_year', 'data_period',
          'locator', 'boundaries', 'limitation', 'geometry_status', 'source_url']
with (BASE / 'published-units.csv').open('w', newline='', encoding='utf-8-sig') as out:
    writer = csv.DictWriter(out, fieldnames=fields)
    writer.writeheader()
    for r in records:
        s = sources[r['source_id']]
        assert r['geometry'] is None and r['map_integration'] == 'solo_referencia_documental'
        row = {key: r[key] for key in fields if key in r}
        row.update(publication_year=s['year'], source_url=s['url'],
                   data_period=json.dumps(r['data_period'], ensure_ascii=False) if r['data_period'] else 'No establecido')
        writer.writerow(row)
lines = ['# Inventario documental de unidades publicadas', '',
         'Generado desde published-units.json. Revisión: ' + data['reviewed_on'] + '.', '',
         data['scope'], '',
         '| ID | Unidad o evidencia | Tipo | Publicación | Localizador | Periodo del dato |',
         '|---|---|---|---|---|---|']
for r in records:
    s = sources[r['source_id']]
    period = r['data_period']
    period_text = f"{period['start']} a {period['end']}" if period else 'No establecido'
    lines.append(f"| {r['id']} | {r['label']} | {r['type']} | [{s['year']}]({s['url']}) | {r['locator']} | {period_text} |")
lines += ['', 'Los límites descritos, restricciones y condiciones de acceso se conservan en JSON y CSV.', '',
          'No se obtuvieron vectores originales. Las dos denominaciones transmitidas por Federico permanecen fuera del inventario confirmado.', '']
(ROOT / 'docs' / 'PUBLISHED_UNITS_TABLE.md').write_text('\n'.join(lines))
print(f'Exportados {len(records)} registros con {len(sources)} fuentes; sin geometrías.')
