#!/usr/bin/env python3
"""Package the compiled static map for the existing Cloudflare project."""
import argparse,hashlib,json,zipfile
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def digest(b):return hashlib.sha256(b).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('output');args=p.parse_args()
 base=ROOT/'dist/public-map';assert (base/'index.html').is_file()
 summary=json.loads((ROOT/'scientific/annual-waterlines/result-summary.json').read_text())
 backgrounds=json.loads((ROOT/'public/data/historical-background/manifest.json').read_text())
 anchored=json.loads((ROOT/'scientific/coverage-extension/anchored-evolution-summary.json').read_text())
 roads=json.loads((ROOT/'public/data/road-kilometres.geojson').read_text())
 assets={str(path.relative_to(base)):path.read_bytes() for path in sorted(base.rglob('*')) if path.is_file()}
 assert max(map(len,assets.values()))<25*1024*1024
 manifest={'created_at':datetime.now(timezone.utc).isoformat(),'measurements':'Landsat and Sentinel; Alec complementary',
  'complete_annual_series':False,'accepted_years':len(summary['window_years_with_observations']),'unfilled_years':len(summary['window_years_without_accepted_observations']),
  'satellite_pixels_included':True,'raw_satellite_dn_included':False,
  'historical_background_pngs':len(backgrounds['frames']),
  'exact_historical_photo_years':[f['year'] for f in backgrounds['frames']],
  'historical_archive_active_as_basemap':False,
  'historical_years_without_exact_archived_photo':backgrounds['missing_years'],
  'active_basemap':'Esri satellite service, reference date independent; repeated captures remain',
  'complete_annual_explorable_basemap':False,
  'pilot_entry_visible':False,'header_wordmark_visible':False,
  'timeline_response':'direct annual selection; no playback backlog; viewport-only rendering; eight-frame geometry cache',
  'raster_loading':'three decoded frames maximum; sequential cold prefetch; obsolete downloads released; 12-second stalled-load retry state',
  'verified_general_recovery_2010_2026':False,
  'reference_policy':anchored['reference_policy'],'reference_axes':anchored['reference_axes'],
  'observed_export_rows':anchored['measured_rows'],'estimated_export_rows':anchored['estimated_rows'],
  'estimates_are_satellite_observations':False,
  'official_place_labels':17,'official_road_kilometres_added':len(roads['features']),
  'road_reference_source':'SICT-IMT / INEGI RNC 2025; original posts, derived road association; chainage origin not inferred',
  'local_capture_choice':'Future local capture replaced when an earlier local image is available; valid selections remain stable',
  'historical_erosion_complement_period':'1986–2011; interval average, not annual positions',
  'positions':summary['total_unique_delivered_product_axis_positions'],'annual_csv_rows':summary['annual_csv_rows'],
  'assets':[{'path':name,'bytes':len(data),'sha256':digest(data)} for name,data in assets.items()]}
 assets['MANIFIESTO_ENTREGA.json']=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode()
 assets['LEEME_DESPLIEGUE.txt']=('Mapa estático compilado para el proyecto existente mapa-satelital de Cloudflare Pages.\n'
  'index.html está en la raíz; no se incluye ninguna credencial ni vínculo de edición al Site anterior.\n'
  f"La entrega contiene {summary['total_delivered_observations']} cortes, {summary['total_unique_delivered_product_axis_positions']:,} posiciones producto/eje y {summary['annual_csv_rows']:,} filas anuales.\n"
  f"Hay datos preliminares en {len(summary['window_years_with_observations'])} años, con cobertura parcial. Permanecen {len(summary['window_years_without_accepted_observations'])} años sin posiciones aceptadas.\n"
  'El mapa usa el servicio Esri; los PNG históricos quedan archivados y no lo sustituyen automáticamente. El fondo aún repite capturas y no cumple un mapa distinto por cada año.\n'
  f"Cada barra usa su primera observación utilizable: {anchored['reference_axes']} referencias. CSV separados: {anchored['measured_rows']} filas medidas y {anchored['estimated_rows']} estimadas.\n"
  'Continua: observaciones. Discontinua: ESTIMADO con tasa de Alec y ancla real dentro del periodo; no es una observación anual. No se estima 2012 ni se extrapola después de 2021.\n'
  f"Se incluyen 17 nombres oficiales de localidades y municipios y {len(roads['features'])} postes kilométricos RNC 2025. La asociación a carretera es derivada; no se inventó el origen del kilometraje.\n"
  'La foto de fondo tiene su fecha propia. Marea, oleaje y validación entre sensores siguen pendientes.\n').encode()
 out=Path(args.output)
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for name,data in assets.items():z.writestr(name,data)
 with zipfile.ZipFile(out) as z:
  assert z.testzip() is None
  for name,data in assets.items():assert z.read(name)==data
 report={'status':'passed','filename':out.name,'files':len(assets),'bytes':out.stat().st_size,
  'sha256':digest(out.read_bytes()),'largest_asset_bytes':max(map(len,assets.values())),
  'all_asset_hashes_verified':True,'index_at_root':True}
 (ROOT/f'docs/qa/cloudflare-package-{datetime.now(timezone.utc).date().isoformat()}.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report))
if __name__=='__main__':main()
