#!/usr/bin/env python3
"""Prepare lossless XYZ display tiles from verified INEGI originals; never edit them.

Requires rasterio 1.4.3, pyproj 3.7.2, numpy and Pillow. Run with --input pointing
to an external directory containing the ZIPs in historical-imagery/inputs.json.
The transfer manifests and the S32 control review remain historical snapshots.
"""
import argparse
import hashlib
import json
import math
import tempfile
import zipfile
from pathlib import Path

import numpy as np
import rasterio
from affine import Affine
from PIL import Image
from pyproj import Transformer
from rasterio.warp import reproject, Resampling, transform_bounds

ROOT = Path(__file__).resolve().parents[1]
CAT = ROOT / 'scientific/catalogue/historical-imagery'
PUBLIC = ROOT / 'public/data/history'
HALF = 20037508.342789244
TILE = 512


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')


def prepare(record, source, temp):
    blob = source.read_bytes()
    assert len(blob) == record['zip_bytes'], source
    assert digest(blob) == record['zip_sha256'], source
    target = temp / record['upc']
    target.mkdir()
    metadata = CAT / record['upc']
    metadata.mkdir(parents=True, exist_ok=True)
    members = []
    with zipfile.ZipFile(source) as archive:
        assert archive.testzip() is None, 'ZIP CRC failure'
        for name in archive.namelist():
            assert len(Path(name).parts) == 1, 'Unexpected ZIP path'
            data = archive.read(name)
            (target / name).write_bytes(data)
            members.append({'name': name, 'bytes': len(data), 'sha256': digest(data)})
            if not name.lower().endswith('.bil'):
                (metadata / name).write_bytes(data)
    bil = next(target.glob('*.bil'))
    provenance = bil.with_suffix('.txt').read_text(encoding='cp1252')
    assert record['flight_evidence'].casefold() in provenance.casefold()
    assert 'ITRF92' in provenance and 'GRS 80' in provenance
    world = [float(x) for x in bil.with_suffix('.blw').read_text().split()]
    # EHdr/HDR and BLW use pixel centers. PAux instead treats UL as an edge.
    with rasterio.open(bil, driver='EHdr') as src:
        assert src.count == 1 and src.dtypes[0] == 'uint8'
        assert bil.stat().st_size == src.width * src.height
        assert np.allclose(src.transform * (.5, .5), (world[4], world[5]))
        assert src.transform.a == record['resolution_m']
        src_transform = src.transform
        src_bounds = src.bounds
        gray = src.read(1)
    crs = 'EPSG:4489'  # Mexico ITRF92 / UTM zone 16N, as delivered in .prj/.txt
    bbox = list(transform_bounds(crs, 'EPSG:4326', *src_bounds, densify_pts=21))
    to_geo = Transformer.from_crs(crs, 'EPSG:4326', always_xy=True)
    left, bottom, right, top = src_bounds
    corners = [(left, top), (right, top), (right, bottom), (left, bottom), (left, top)]
    ring = []
    for a, b in zip(corners, corners[1:]):
        for frac in np.linspace(0, 1, 21, endpoint=False):
            ring.append(list(to_geo.transform(a[0] + frac * (b[0]-a[0]), a[1] + frac * (b[1]-a[1]))))
    ring.append(ring[0])
    bounds_m = transform_bounds(crs, 'EPSG:3857', *src_bounds, densify_pts=21)
    tile_records = []
    for zoom in range(9, record['maxzoom'] + 1):
        span = 2 * HALF / 2**zoom
        x0, x1 = math.floor((bounds_m[0] + HALF) / span), math.floor((bounds_m[2] + HALF) / span)
        y0, y1 = math.floor((HALF - bounds_m[3]) / span), math.floor((HALF - bounds_m[1]) / span)
        width, height = (x1-x0+1)*TILE, (y1-y0+1)*TILE
        dst = np.zeros((2, height, width), dtype=np.uint8)
        transform = Affine(span/TILE, 0, x0*span-HALF, 0, -span/TILE, HALF-y0*span)
        # No original nodata is declared. Zero is a valid gray value; alpha only
        # denotes the outside of the delivered rectangular raster footprint.
        for channel, resampling in ((gray, Resampling.bilinear), (np.full(gray.shape, 255, dtype=np.uint8), Resampling.nearest)):
            band = 0 if resampling == Resampling.bilinear else 1
            reproject(channel, dst[band], src_transform=src_transform, src_crs=crs,
                      dst_transform=transform, dst_crs='EPSG:3857',
                      resampling=resampling, num_threads=2)
        for x in range(x0, x1+1):
            folder = PUBLIC / record['upc'] / str(zoom) / str(x)
            folder.mkdir(parents=True, exist_ok=True)
            for y in range(y0, y1+1):
                patch = dst[:, (y-y0)*TILE:(y-y0+1)*TILE, (x-x0)*TILE:(x-x0+1)*TILE]
                im = Image.fromarray(patch.transpose(1, 2, 0), mode='LA').convert('RGBA')
                path = folder / f'{y}.webp'
                im.save(path, format='WEBP', lossless=True, method=4, exact=True)
                payload = path.read_bytes()
                tile_records.append({'path': str(path.relative_to(ROOT / 'public')), 'bytes': len(payload), 'sha256': digest(payload)})
        del dst
        print(record['sheet'], zoom, (x1-x0+1)*(y1-y0+1), 'tiles', flush=True)
    frame = {
        'id': record['upc'], 'sheet': record['sheet'], 'epoch': record['epoch'],
        'capture_month': record['capture_month'], 'date_precision': 'month',
        'resolution_m': record['resolution_m'], 'bounds': bbox,
        'footprint': {'type': 'Polygon', 'coordinates': [ring]},
        'tiles': f"/data/history/{record['upc']}/{{z}}/{{x}}/{{y}}.webp",
        'minzoom': 9, 'maxzoom': record['maxzoom'], 'tile_size': TILE,
        'catalogue_url': record['catalogue_url'], 'original_url': record['source_url'],
        'metadata_url': f"/data/history/metadata/{record['upc']}.txt",
        'note': record.get('note', ''),
        'display_resolution_m_at_21_27N': round(2 * HALF / (TILE * 2**record['maxzoom']) * math.cos(math.radians(21.27)), 3),
    }
    (PUBLIC / 'metadata').mkdir(exist_ok=True)
    (PUBLIC / 'metadata' / f"{record['upc']}.txt").write_text(provenance, encoding='utf-8')
    audit = dict(record, zip_crc_ok=True, members=members, src_crs=crs,
                 src_transform=list(src_transform)[:6], src_bounds=list(src_bounds),
                 width=gray.shape[1], height=gray.shape[0], frame=frame,
                 tile_count=len(tile_records), tile_bytes=sum(t['bytes'] for t in tile_records))
    return frame, audit, tile_records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    args = parser.parse_args()
    records = json.loads((CAT / 'inputs.json').read_text())
    frames, audits, tiles = [], [], []
    with tempfile.TemporaryDirectory(prefix='chelem-ortho-') as tmp:
        for record in records:
            matches = list(args.input.rglob(record['external_original']))
            assert len(matches) == 1, (record['upc'], matches)
            frame, audit, tile_list = prepare(record, matches[0], Path(tmp))
            frames.append(frame); audits.append(audit); tiles.extend(tile_list)
    manifest = {'schema_version': 1, 'prepared_on': '2026-09-24',
                'attribution': 'INEGI. Ortofotos digitales. Reproyectadas y remuestreadas para visualización por Celda Chelem.',
                'frames': frames,
                'epochs': [
                    {'id': '1995-11', 'year': 1995, 'label': 'Noviembre de 1995', 'short_label': 'Nov 1995', 'resolution_m': 2},
                    {'id': '2005-01', 'year': 2005, 'label': 'Enero de 2005', 'short_label': 'Ene 2005', 'resolution_m': 1},
                ],
                'comparison_bounds': [-89.832, 21.243, -89.704, 21.287],
                'method': 'Georreferencia original, centros de píxel EHdr/BLW; EPSG:4489 → EPSG:3857; bilineal; WebP sin pérdida; sin ajustes de contraste ni georreferenciación de S32.',
                'limits': 'Comparación visual, sin mediciones de cambio ni límites catastrales. Sin imágenes entre las dos fechas. Fuera de las huellas no hay imagen. En solapes se dibuja encima la hoja siguiente en el manifiesto.'}
    write_json(PUBLIC / 'manifest.json', manifest)
    write_json(CAT / 'inspection.json', {'records': audits, 's32_controls_accepted_this_step': 0, 's32_transform': None, 's32_rmse': None})
    write_json(CAT / 'tiles-manifest.json', tiles)
    print(json.dumps({'frames': len(frames), 'tiles': len(tiles), 'bytes': sum(t['bytes'] for t in tiles)}), flush=True)


if __name__ == '__main__':
    main()
