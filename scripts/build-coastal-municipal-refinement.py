"""Compile reviewed endpoints and original metadata into a private grid plan."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import Point, Polygon


ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work/hunucma-yobain'
RAW = ROOT / 'public/data/shorelines/photo-alignment/revised-data.json'
METHOD = 'manual-water-sand-contact-hunucma-yobain'
METHOD_URL = '/data/shorelines/photo-alignment/hunucma-yobain-method.md'


def read(path: Path) -> dict:
    return json.loads(path.read_bytes())


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path: Path, payload: dict) -> None:
    path.write_bytes((json.dumps(payload, ensure_ascii=False, indent=2) + '\n').encode())


def contact(target: dict, offset: float) -> list[float]:
    """Use the project's source offset convention before WGS84 stationing."""
    lon, lat = map(math.radians, target['p'])
    east, north = target['v']
    scale = 6378137 * math.cos(lat)
    return [
        math.degrees(lon + east * offset / scale),
        math.degrees(math.atan(math.sinh(math.asinh(math.tan(lat)) + north * offset / scale))),
    ]


class Footprint:
    def __init__(self, metadata: dict) -> None:
        self.metadata = metadata
        path = ROOT / metadata['path']
        assert digest(path) == metadata['sha256'], path
        payload = read(path)
        assert payload['spatialReference']['wkid'] == 4326 and not payload.get('exceededTransferLimit')
        self.features = [
            (feature['attributes'], [Polygon(ring) for ring in feature['geometry']['rings']])
            for feature in payload['features']
        ]

    def check(self, coordinate: list[float], capture: dict) -> None:
        point = Point(coordinate)
        matches = [a for a, rings in self.features if sum(ring.covers(point) for ring in rings) % 2]
        assert len(matches) == 1, (coordinate, len(matches))
        attrs = matches[0]
        date = dt.datetime.fromtimestamp(attrs['SRC_DATE2'] / 1000, dt.timezone.utc).date().isoformat()
        assert date == capture['date'] and attrs['SRC_DESC'] == capture['source'], (coordinate, date, attrs['SRC_DESC'], capture)


def compile_scope(scope: dict) -> tuple[dict, list[dict]]:
    folder = ROOT / 'public/data/municipalities' / scope['slug']
    photos = read(folder / 'photos.json')
    model = {target['id']: target for target in read(folder / 'scenario.json')['targets']}
    previous = {row['id']: row for row in photos['targets']}
    primary = {id for id, target in model.items() if target['type'].startswith('Playa')}
    footprint_cache: dict[int, Footprint] = {}
    sources, changes, withheld = [], [], []
    references = {}
    aux = set()
    for entry in scope['decisions']:
        path = ROOT / entry['path']
        assert digest(path) == entry['sha256'], path
        records = read(path)['records']
        for row in records:
            profile = row['id']
            assert profile in primary or entry.get('auxiliary') and model[profile]['type'] == 'Otros', profile
            is_reference = entry.get('reference', False)
            offset = row['offset_m']
            capture_id, release = row['capture'], row['release']
            old = next((r for r in previous[profile]['readings'] if r['capture'] == capture_id and release in r['releases']), None)
            panel_path = row.get('evidence_panel')
            if panel_path:
                assert digest(ROOT / panel_path) == row['screenshot_sha256'], panel_path
            if is_reference:
                assert profile not in references, profile
            if offset is None:
                assert row.get('reason'), profile
                if is_reference and profile in primary:
                    references[profile] = {'profile_id': profile, 'reason': row['reason']}
                elif not is_reference and old is not None:
                    withheld.append({'profile_id': profile, 'capture': capture_id, 'release': release, 'reason': row['reason']})
                continue
            assert panel_path and old is not None and math.isfinite(offset) and abs(offset) < 195, row
            capture = photos['captures'][capture_id]
            assert not is_reference or capture['date'].startswith('2011-'), profile
            if 'original_offset_m' in row:
                assert old['offset_m'] == row['original_offset_m'], row
            if 'original_accepted' in row:
                assert old['accepted'] == row['original_accepted'], row
            if row.get('previous'):
                assert old == row['previous'], profile
            if release not in footprint_cache:
                footprint_cache[release] = Footprint(scope['footprints'][str(release)])
            footprint = footprint_cache[release]
            coordinate = contact(model[profile], offset)
            footprint.check(coordinate, capture)
            source_id = f"{scope['slug']}-{profile}-{capture_id}-{release}"
            sources.append({
                'id': source_id, 'release': release, 'capture_date': capture['date'],
                'panel': panel_path, 'screenshot_sha256': row['screenshot_sha256'],
                'coordinate': coordinate, 'metadata_sha256': footprint.metadata['sha256'],
                'metadata_url': footprint.metadata['url'], 'metadata_endpoint_verified': True,
            })
            changes.append({
                'profile_id': profile, 'capture': capture_id, 'date': capture['date'],
                'releases': [release], 'original_offset_m': old['offset_m'], 'original_accepted': old['accepted'],
                'offset_m': offset, 'manual_uncertainty_m': row.get('manual_uncertainty_m', 8), 'source': source_id,
            })
            for edition in row.get('additional_editions', []):
                extra_release = edition['release']
                assert extra_release != release and extra_release in old['releases']
                extra_panel = edition['evidence_panel']
                assert digest(ROOT / extra_panel) == edition['screenshot_sha256']
                if extra_release not in footprint_cache:
                    footprint_cache[extra_release] = Footprint(scope['footprints'][str(extra_release)])
                extra = footprint_cache[extra_release]
                extra.check(coordinate, capture)
                extra_id = f"{scope['slug']}-{profile}-{capture_id}-{extra_release}"
                sources.append({
                    'id': extra_id, 'release': extra_release, 'capture_date': capture['date'],
                    'panel': extra_panel, 'screenshot_sha256': edition['screenshot_sha256'],
                    'coordinate': coordinate, 'metadata_sha256': extra.metadata['sha256'],
                    'metadata_url': extra.metadata['url'], 'metadata_endpoint_verified': True,
                })
                changes[-1]['releases'].append(extra_release)
                changes[-1].setdefault('additional_sources', []).append(extra_id)
            if is_reference:
                references[profile] = {'profile_id': profile, 'capture': capture_id, 'release': release}
                if profile not in primary:
                    aux.add(profile)
    missing = primary.difference(references)
    if scope.get('retain_unrevised_references'):
        assert all(previous[id].get('fixed_reference') or previous[id].get('reference_unavailable') for id in missing), missing
    else:
        assert not missing, missing
    assert len(changes) == len({(r['profile_id'], r['capture']) for r in changes}), scope['slug']
    geometry_path = ROOT / scope['geometry']['path']
    assert digest(geometry_path) == scope['geometry']['sha256']
    geometry = read(geometry_path)['reference_geometry']
    for path in geometry:
        coords = path['coordinates']
        assert path['municipality'] == scope['municipality'] and len(coords) > 1
        assert all(a[0] < b[0] for a, b in zip(coords, coords[1:]))
        release = path.get('release', 11019)
        capture = photos['captures'][path.get('capture', 40)]
        if release not in footprint_cache:
            footprint_cache[release] = Footprint(scope['footprints'][str(release)])
        for coordinate in coords:
            footprint_cache[release].check(coordinate, capture)
    asset = {
        'version': 1, 'status': 'independently_reviewed', 'field_validated': False,
        'data_sha256': digest(RAW), 'model_sha256': photos['model_sha256'],
        'source_photos_sha256': digest(folder / 'photos.json'),
        'method': METHOD, 'method_url': METHOD_URL, 'last_year': scope['last_year'],
        'references': list(references.values()), 'corrections': changes, 'sources': sources, 'withheld': withheld,
        'auxiliary_beach_controls': sorted(aux),
        'evidence': {entry['path']: entry['sha256'] for entry in scope['decisions'] + [scope['geometry']]},
    }
    return asset, geometry


def main() -> None:
    inputs = read(WORK / 'inputs.json')
    scopes, geometry = [], []
    for scope in inputs['scopes']:
        asset, paths = compile_scope(scope)
        slug = scope['slug']
        write(WORK / f'refinement-{slug}.json', asset)
        scopes.append({
            'slug': slug, 'municipality': scope['municipality'],
            'photos': (WORK / f'photos-{slug}.json').relative_to(ROOT).as_posix(),
        })
        geometry.extend(paths)
        print(f"{slug}: {len(asset['references'])} reference decisions, {len(asset['corrections'])} photographic readings, {len(paths)} paths")
    write(WORK / 'plan.json', {'scopes': scopes, 'reference_geometry': geometry, 'method_url': METHOD_URL})


if __name__ == '__main__':
    main()
