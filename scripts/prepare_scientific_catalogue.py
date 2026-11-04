"""Derive a candidate inventory from the four retained S27 metadata responses.

No downloads, cloud masking, shoreline extraction or scientific validation.
"""
import argparse
import json
from pathlib import Path
from scientific_intake import PROJECT, digest, read_json, require


def prepare(source_root, destination):
    candidates, assets = [], []
    for year in [2016, 2020, 2025, 2026]:
        path = source_root / 'work' / 'originals' / f'sentinel_catalogue_{year}.json'
        metadata_hash = digest(path)
        download_manifest = read_json(source_root / 'evidence' / 'download_manifest.json')
        recorded = {r['path']: r['sha256'] for r in download_manifest['files']}
        require(recorded.get(str(path.relative_to(source_root))) == metadata_hash,
                f'Cambió el original S27: {path.name}')
        for product in read_json(path)['value']:
            a = {attr['Name']: attr['Value'] for attr in product['Attributes']}
            candidates.append({
                'scene_id': product['Id'], 'source_id': 'S27', 'product_name': product['Name'],
                'capture_time': product['ContentDate']['Start'],
                'platform': a.get('platformShortName'), 'platform_serial': a.get('platformSerialIdentifier'),
                'processing_level': a.get('processingLevel'), 'tile': a.get('tileId'),
                'footprint': product['GeoFootprint'], 'footprint_crs': 'EPSG:4326',
                'product_cloud_cover_percent': a.get('cloudCover'),
                'local_cloud_cover_percent': None, 'local_quality': 'not_assessed',
                'pixels_received': False, 'scientific_review': 'pending',
                'coverage_status': 'Prior audit: footprint intersects official Chelem point; full area unverified',
                'metadata_file': str(path.relative_to(source_root)), 'metadata_sha256': metadata_hash,
                'image_product_size_bytes': product['ContentLength'],
                'limitation': 'Product-wide cloud metadata; not measured over Chelem. L1C/L2A are not a comparable series.'})
        assets.append({
            'asset_id': f'S27-METADATA-{year}', 'path': path.name, 'sha256': metadata_hash,
            'size_bytes': path.stat().st_size, 'kind': 'metadata', 'origin': 'official',
            'license': 'Copernicus metadata; see Stage A S27. Receipt does not grant imagery publication rights.',
            'permissions': dict.fromkeys(['analysis', 'web_display', 'redistribution'], 'unknown'),
            'capture_time': None, 'capture_unknown_reason': 'Metadata response, not a captured image; scene capture is in the catalogue.',
            'crs': 'EPSG:4326', 'crs_unknown_reason': None, 'format': 'application/json'})
    require(len({c['scene_id'] for c in candidates}) == len(candidates), 'Escenas duplicadas')
    config = PROJECT / 'public' / 'data' / 'config.json'
    catalogue = {
        'schema_version': 1, 'area_id': 'chelem-study-area', 'name': 'Área preliminar de estudio — Chelem',
        'operational_bounds': read_json(config)['operational_bounds'],
        'extent_source': 'public/data/config.json', 'extent_source_sha256': digest(config),
        'scientific_boundary': None, 'boundary_status': 'SCI01–SCI03 pending',
        'assigned_team': None, 'scientific_reviewer': None,
        'target_period': {'start_year': 1984, 'end_year': 2026, 'status': 'search_objective'},
        'received_pixel_count': 0, 'accepted_shoreline_count': 0,
        'candidates': sorted(candidates, key=lambda c: c['capture_time']),
        'dependencies': [
            {'source': 'S34', 'product': 'UNAM shorelines, transects, method and validation', 'status': 'not_received'},
            {'source': 'S28', 'product': 'Local Landsat pixel series', 'status': 'not_received'},
            {'source': 'ERMEX', 'product': 'SPOT scenes and reuse terms', 'status': 'not_received'},
            {'source': 'Field', 'product': 'Original photographs and measurements', 'status': 'not_received'}]}
    manifest = {'schema_version': 1, 'package_id': 'S27-CANDIDATE-METADATA', 'version': 1,
                'previous_manifest_sha256': None, 'area_id': catalogue['area_id'],
                'title': 'Four retained Sentinel-2 catalogue responses, not imagery',
                'provider': 'ESA / Copernicus Data Space', 'source_id': 'S27', 'assets': assets,
                'limitations': 'Metadata only. Mixed L1C/L2A; no local cloud, tide, pixels or full-area coverage validation.'}
    destination.mkdir(parents=True, exist_ok=True)
    for name, value in [('chelem-candidates.json', catalogue), ('s27-receipt-manifest.json', manifest)]:
        (destination / name).write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    return len(candidates)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source-root', type=Path, required=True)
    p.add_argument('--output', type=Path, default=PROJECT / 'scientific' / 'catalogue')
    args = p.parse_args()
    print(f'{prepare(args.source_root.resolve(), args.output)} candidates; no imagery or shoreline observations received.')
