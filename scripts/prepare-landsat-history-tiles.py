#!/usr/bin/env python3
"""Offline XYZ map from received dated Landsat visual rasters.

Preserves input PNG/DN files and all measurements. The existing PNGs are
georeferenced in EPSG:3857, as recorded in their preparation receipt.
No sharpening, invented dates, source download or scientific acceptance.
"""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import io
import json
import math
import shutil

import numpy as np
from PIL import Image
from affine import Affine
from rasterio.warp import reproject, Resampling

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
OUT = PUBLIC / 'data/history'
WORK = ROOT / 'work/2026-10-28-historico-integrado'
HALF = 20037508.342789244
TILE = 512
MIN_ZOOM, MAX_ZOOM = 8, 12
MAX_NEW_BYTES = 30 * 1024**2


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def write_new(path, raw):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != raw:
            raise ValueError(f'Existing derived file differs: {path}')
        return
    path.write_bytes(raw)


def main():
    if shutil.disk_usage(ROOT).free < 100 * 1024**2 + MAX_NEW_BYTES:
        raise RuntimeError('Keep 100 MiB free in addition to the bounded tile job')
    manifest_path = PUBLIC / 'data/historical-background/manifest.json'
    manifest = json.loads(manifest_path.read_bytes())
    proof_path = ROOT / 'scientific/coverage-extension/historical-background-proof.json'
    proof = json.loads(proof_path.read_bytes())
    by_image = {p['image']: p for p in proof['frames']}
    frames, epochs, records = [], [], []
    total_bytes = 0
    for item in sorted(manifest['frames'], key=lambda f: f['date']):
        original = PUBLIC / item['image'].lstrip('/')
        raw = original.read_bytes()
        assert sha(raw) == item['image_sha256']
        received = by_image[item['image']]
        assert received['image_sha256'] == sha(raw)
        source = np.array(Image.open(io.BytesIO(raw)).convert('RGBA'))
        assert list(source.shape[:2]) == received['image_shape']
        transform = Affine(*received['image_transform_epsg3857'][:6])
        h, w = source.shape[:2]
        west, north = transform.c, transform.f
        east, south = west + transform.a * w, north + transform.e * h
        count = 0
        for z in range(MIN_ZOOM, MAX_ZOOM + 1):
            span = 2 * HALF / 2**z
            x0, x1 = math.floor((west + HALF) / span), math.floor((east + HALF) / span)
            y0, y1 = math.floor((HALF - north) / span), math.floor((HALF - south) / span)
            for x in range(x0, x1 + 1):
                for y in range(y0, y1 + 1):
                    target = np.zeros((4, TILE, TILE), dtype='uint8')
                    dst = Affine(span / TILE, 0, x * span - HALF, 0, -span / TILE, HALF - y * span)
                    for band in range(4):
                        reproject(source[:, :, band], target[band],
                                  src_transform=transform, src_crs='EPSG:3857',
                                  dst_transform=dst, dst_crs='EPSG:3857',
                                  resampling=Resampling.nearest, SRC_COORD_PRECISION=1e-8)
                    encoded = io.BytesIO()
                    Image.fromarray(np.moveaxis(target, 0, 2)).save(
                        encoded, format='WEBP', lossless=True, exact=True, method=4)
                    data = encoded.getvalue()
                    total_bytes += len(data)
                    if total_bytes > MAX_NEW_BYTES:
                        raise RuntimeError('Bounded display tile budget exceeded; do not keep generating')
                    path = OUT / 'landsat' / str(item['year']) / str(z) / str(x) / f'{y}.webp'
                    write_new(path, data)
                    decoded = np.array(Image.open(io.BytesIO(data)).convert('RGBA'))
                    assert np.array_equal(decoded, np.moveaxis(target, 0, 2))
                    records.append({'path': str(path.relative_to(PUBLIC)), 'bytes': len(data), 'sha256': sha(data)})
                    count += 1
        west_g, south_g, east_g, north_g = item['bounds']
        metadata_url = f'/data/history/landsat/{item["year"]}/source.json'
        frame = {
            'id': item['id'], 'sheet': item['product_id'], 'epoch': item['date'],
            'capture_month': item['date'][:7], 'capture_date': item['date'],
            'date_precision': 'day', 'resolution_m': 30,
            'bounds': item['bounds'], 'footprint': {'type': 'Polygon', 'coordinates': [[
                [west_g, south_g], [east_g, south_g], [east_g, north_g], [west_g, north_g], [west_g, south_g]]]},
            'tiles': f'/data/history/landsat/{item["year"]}/{{z}}/{{x}}/{{y}}.webp',
            'minzoom': MIN_ZOOM, 'maxzoom': MAX_ZOOM, 'tile_size': TILE,
            'catalogue_url': 'https://www.usgs.gov/landsat-missions/landsat-collection-2',
            'original_url': item['sourceUrl'], 'metadata_url': metadata_url,
            'note': item['note'], 'image_kind': item['image_kind'],
            'source_png_sha256': item['image_sha256'],
        }
        write_new(PUBLIC / metadata_url.lstrip('/'), (json.dumps({
            'capture_date': item['date'], 'date_precision': 'day', 'product_id': item['product_id'],
            'source_png': item['image'], 'source_png_sha256': item['image_sha256'],
            'source_metadata_url': item['sourceUrl'], 'native_resolution_m': 30,
            'tile_preparation': 'Received EPSG:3857 visual raster to lossless XYZ; nearest neighbour; no new measurement',
            'original_preparation_receipt': 'scientific/coverage-extension/historical-background-proof.json',
            'has_accepted_annual_measurements': item['has_accepted_annual_measurements'],
            'note': item['note'],
        }, ensure_ascii=False, indent=2) + '\n').encode())
        frames.append(frame)
        epochs.append({'id': item['date'], 'year': item['year'],
                       'label': item['date'], 'short_label': str(item['year']), 'resolution_m': 30})
        assert sha(original.read_bytes()) == item['image_sha256']
        print(json.dumps({'year': item['year'], 'tiles': count, 'cumulative_bytes': total_bytes}), flush=True)
    result = {
        'schema_version': 1, 'prepared_on': '2026-10-28',
        'attribution': 'USGS / NASA · Landsat. Teselas de visualización preparadas a partir de los datos recibidos.',
        'frames': frames, 'epochs': epochs,
        'comparison_bounds': manifest['frames'][0]['bounds'],
        'method': 'Archivo georreferenciado EPSG:3857 recibido → XYZ WebP sin pérdida; vecino más cercano; sin nuevos ajustes de color ni mediciones.',
        'limits': 'Cobertura parcial Chelem–Progreso, 30 m nativos. Fechas reales, no una captura por año. Años sin imagen usan una referencia anterior fechada. Fuera de cobertura no se reemplaza silenciosamente con una fecha moderna.',
    }
    write_new(OUT / 'landsat-tiles.json', (json.dumps(result, ensure_ascii=False, indent=2) + '\n').encode())
    WORK.mkdir(parents=True, exist_ok=True)
    report = {'checked_at': datetime.now(timezone.utc).isoformat(), 'status': 'passed',
              'source_manifest_sha256': sha(manifest_path.read_bytes()),
              'source_proof_sha256': sha(proof_path.read_bytes()),
              'frames': len(frames), 'years': [e['year'] for e in epochs],
              'tiles': records, 'tile_bytes': total_bytes, 'tile_count': len(records),
              'network_requests': 0, 'new_measurements': 0, 'input_images_unchanged': True,
              'lossless_tile_decoding_verified': True, 'source_crs': 'EPSG:3857'}
    (WORK / 'landsat-tiles-receipt.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'tiles'}), flush=True)


if __name__ == '__main__':
    main()
