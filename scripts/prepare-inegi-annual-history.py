"""Publish a small WMS manifest from reviewed annual service responses."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
REVIEW = ROOT / 'work/2026-10-28-historico-integrado/inegi-annual-review/review.json'
data = json.loads(REVIEW.read_text())
rows = data['years']
if len(rows) != 33 or {r['year'] for r in rows} != set(range(1993,2026)):
    raise ValueError('Incomplete annual display review')
if not all(r['ok'] and r['all_locality_samples_visible'] and r['cors'] == '*' for r in rows):
    raise ValueError('An annual response failed coverage or browser access QA')
if len({r['sha256'] for r in rows}) != len(rows):
    raise ValueError('Repeated annual overview response')
bounds = data['bounds']
w,s,e,n = bounds
footprint = {'type':'Polygon','coordinates':[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}
base = 'https://mapas.inegi.org.mx/geoserver/Sitio_Inegi/wms'
program = 'https://www.inegi.org.mx/programas/geomediana/'
method = 'https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/bvinegi/productos/nueva_estruc/702825198763.pdf'
manifest = dict(schema_version=1,prepared_on='2026-10-28',
    attribution='Fuente: INEGI, Geomediana Landsat. Visualización del proyecto; sin aval institucional.',
    comparison_bounds=bounds,
    method='Servicio cartográfico WMS oficial, consultado por teselas según el desplazamiento y zoom. Cada capa usa su propio año de referencia; sin sustitución por otro año. Compuesto estadístico de observaciones Landsat del periodo anual, no captura de un día.',
    limits='Resolución original30m. Los colores naturales se sirven para visualización; no certifican erosión ni sustituyen las observaciones científicas. El servicio depende de Internet y de la disponibilidad de INEGI. Revisión panorámica del encuadre costero y puntos testigo, no auditoría exhaustiva de cada píxel nativo. Periodos1984–1989 y1990–1992 excluidos de la selección anual.2026 no tiene capa anual publicada comprobada.',
    epochs=[],frames=[])
for r in rows:
    year=r['year']; epoch=f'{year}-inegi-geomedian'
    manifest['epochs'].append(dict(id=epoch,year=year,label=f'Geomediana INEGI · {year}',short_label=str(year),resolution_m=30))
    manifest['frames'].append(dict(id='inegi-geomedian-'+str(year),sheet=r['layer'],epoch=epoch,
        capture_year=year,date_precision='year',period_start=f'{year}-01-01',period_end=f'{year}-12-31',
        resolution_m=30,bounds=bounds,footprint=footprint,tile_protocol='wms',
        wms=dict(url=base,layers=r['layer'],version='1.1.1',format='image/png',crs='EPSG:3857'),
        tiles=base+'?service=WMS&version=1.1.1&request=GetMap&layers='+r['layer']+'&styles=&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/png&transparent=true',
        minzoom=7,maxzoom=13,tile_size=256,catalogue_url=program,original_url=base,metadata_url=method,
        note='Mosaico anual por teselas; desplazamiento y zoom continuos en toda la costa. Año del compuesto, no fecha de adquisición puntual. Resolución30m; acercar no crea detalle adicional. No se usa como medición de la línea del agua.'))
out = ROOT / 'public/data/history/geomedian.json'
out.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(manifest=str(out.relative_to(ROOT)),bytes=out.stat().st_size,years=len(rows),remote_raster_data_downloaded_for_delivery=0)))
