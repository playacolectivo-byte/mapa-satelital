"""Side-by-side native-image QA for the fixed 100 m Chicxulub baseline.

The left crop is unmarked; the right crop has a hollow crosshair at the
station coordinate. Both use the same cached Esri 11019 tiles at z17 and
nearest-neighbour enlargement. No coastline is inferred from RGB values.
"""
from __future__ import annotations

import argparse
import datetime as dt
import functools
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from pyproj import Geod, Transformer
from rasterio import Affine
from rasterio.windows import Window, transform as window_transform
from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
GRID = ROOT / 'public/data/shorelines/photo-alignment/coastal-100m-grid-20261106.json'
TILES = ROOT / 'work/progreso-full-review-20261105/tiles/11019'
FOOTPRINTS = ROOT / 'work/progreso-full-review-20261105/baseline-corrected-endpoint-footprints.json'
OUTPUT = ROOT / 'work/chicxulub-reference-review-20261106/grid-qa'
ZOOM = 17
LON_RANGE = (-89.6442, -89.5702)
MUNICIPALITY = 'Progreso'
SCALE = 3
CROP_WIDTH, CROP_HEIGHT = 72, 52
WORLD = 6378137 * math.pi
PX_M = 2 * WORLD / (256 * 2**ZOOM)
WEB_FROM_PIXEL = Affine(PX_M, 0, -WORLD, 0, -PX_M, WORLD)
PIXEL_FROM_WEB = ~WEB_FROM_PIXEL
TO_WEB = Transformer.from_crs(4326, 3857, always_xy=True)
TO_LONLAT = Transformer.from_crs(3857, 4326, always_xy=True)
GEOD = Geod(ellps='WGS84')
PANEL_COLUMNS = 3
CELL_WIDTH = 2 * CROP_WIDTH * SCALE + 12
CELL_HEIGHT = CROP_HEIGHT * SCALE + 63


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path.resolve())


def pixel(coordinate: list[float]) -> tuple[float, float]:
    return PIXEL_FROM_WEB * TO_WEB.transform(*coordinate, errcheck=True)


def coordinate(px: tuple[float, float]) -> tuple[float, float]:
    return TO_LONLAT.transform(*(WEB_FROM_PIXEL * px), errcheck=True)


@functools.lru_cache(maxsize=1)
def footprints() -> list[tuple[dict, list[Polygon]]]:
    data = json.loads(FOOTPRINTS.read_bytes())
    assert data['spatialReference']['wkid'] == 4326
    return [(f['attributes'], [Polygon(ring) for ring in f['geometry']['rings']]) for f in data['features']]


def verify_photo(point: tuple[float, float] | list[float]) -> dict:
    position = Point(point)
    covering = [a for a, rings in footprints() if sum(ring.covers(position) for ring in rings) % 2]
    assert len(covering) == 1, f'Photo source is not unique at {point}'
    a = covering[0]
    date = dt.datetime.fromtimestamp(a['SRC_DATE2'] / 1000, dt.timezone.utc).date().isoformat()
    assert date == '2011-08-01' and a['SRC_DESC'] == 'WV02'
    return {'date': date, 'sensor': a['SRC_DESC'], 'provider': a['NICE_DESC'],
            'source_resolution_m': a['SAMP_RES'], 'source_accuracy_m': a['SRC_ACC']}


@functools.lru_cache(maxsize=128)
def source_tile(x: int, y: int) -> tuple[Image.Image, dict]:
    path = TILES / f'{ZOOM}-{x}-{y}.jpg'
    if not path.is_file():
        raise FileNotFoundError(f'Missing original cached Esri tile: {path}')
    with Image.open(path) as original:
        image = original.convert('RGB')
    assert image.size == (256, 256)
    return image, {'x': x, 'y': y, 'path': relative(path), 'sha256': sha(path)}


def crop_around(px: tuple[float, float]) -> tuple[Image.Image, Window, list[dict]]:
    origin_x = math.floor(px[0]) - CROP_WIDTH // 2
    origin_y = math.floor(px[1]) - CROP_HEIGHT // 2
    window = Window(origin_x, origin_y, CROP_WIDTH, CROP_HEIGHT)
    image = Image.new('RGB', (CROP_WIDTH, CROP_HEIGHT))
    provenance = []
    for y in range(origin_y // 256, (origin_y + CROP_HEIGHT - 1) // 256 + 1):
        for x in range(origin_x // 256, (origin_x + CROP_WIDTH - 1) // 256 + 1):
            tile, evidence = source_tile(x, y)
            image.paste(tile, (x * 256 - origin_x, y * 256 - origin_y))
            provenance.append(evidence)
    transform = window_transform(window, WEB_FROM_PIXEL)
    assert (transform * (0, 0)) == (WEB_FROM_PIXEL * (origin_x, origin_y))
    return image, window, provenance


def reticle(draw: ImageDraw.ImageDraw, cx: float, cy: float) -> None:
    # Leave the water/sand pixels immediately under the station untouched.
    for a, b in [((-14, 0), (-6, 0)), ((6, 0), (14, 0)), ((0, -14), (0, -6)), ((0, 6), (0, 14))]:
        line = [(round(cx + x), round(cy + y)) for x, y in (a, b)]
        draw.line(line, fill='#13262c', width=3)
        draw.line(line, fill='#00f5ff', width=1)


def read_stations(grid: dict) -> list[dict]:
    assert grid['spacing_m'] == 100
    result = []
    for segment in grid['segments']:
        if segment['municipality'] != MUNICIPALITY:
            continue
        for station in segment['stations']:
            if LON_RANGE[0] <= station['coordinate'][0] <= LON_RANGE[1]:
                result.append({**station, 'segment': segment['id']})
    result.sort(key=lambda s: (s['coordinate'][0], s['coordinate'][1], s['id']))
    assert len({s['id'] for s in result}) == len(result) and result
    return result


def render(grid_path: Path, output: Path) -> None:
    raw = grid_path.read_bytes()
    stations = read_stations(json.loads(raw))
    output.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 13)
    rows = []
    for start in range(0, len(stations), 6):
        sheet = Image.new('RGB', (PANEL_COLUMNS * CELL_WIDTH, 2 * CELL_HEIGHT + 19), '#172b31')
        draw = ImageDraw.Draw(sheet)
        panel = output / f'grid-{start:03}.png'
        group = []
        for j, station in enumerate(stations[start:start + 6]):
            px = pixel(station['coordinate'])
            assert GEOD.inv(*coordinate(px), *station['coordinate'])[2] < 1e-5
            crop, window, provenance = crop_around(px)
            x = (j % PANEL_COLUMNS) * CELL_WIDTH + 3
            y = (j // PANEL_COLUMNS) * CELL_HEIGHT
            raw_x, marked_x, top = x, x + CROP_WIDTH * SCALE + 4, y + 48
            enlarged = crop.resize((CROP_WIDTH * SCALE, CROP_HEIGHT * SCALE), Image.Resampling.NEAREST)
            sheet.paste(enlarged, (raw_x, top))
            sheet.paste(enlarged, (marked_x, top))
            rel = [px[0] - window.col_off, px[1] - window.row_off]
            display_raw = [raw_x + SCALE * rel[0], top + SCALE * rel[1]]
            display_marked = [marked_x + SCALE * rel[0], display_raw[1]]
            reticle(draw, *display_marked)
            draw.text((x, y + 1), f'{start+j:03}  {station["id"]}   |   {station["chainage_m"]} m', font=font, fill='white')
            lon, lat = station['coordinate']
            draw.text((x, y + 16), f'{lon:.9f}, {lat:.9f}   |   2011-08-01', font=font, fill='#dcebef')
            draw.text((raw_x, y + 32), 'Original sin marca', font=font, fill='#dcebef')
            draw.text((marked_x, y + 32), 'Centro de estacion', font=font, fill='#00f5ff')
            east_px_m = GEOD.inv(lon, lat, *coordinate((px[0] + 1, px[1])))[2]
            south_px_m = GEOD.inv(lon, lat, *coordinate((px[0], px[1] + 1)))[2]
            group.append({**station, 'index': start + j, 'panel': relative(panel), 'panel_cell': j,
                          'world_pixel': list(px), 'crop_native_window': [window.col_off, window.row_off, window.width, window.height],
                          'unmarked_display_pixel': display_raw, 'marked_display_pixel': display_marked,
                          'ground_m_per_native_pixel_east_south': [east_px_m, south_px_m],
                          'source_tiles': provenance, 'verified_photo': verify_photo(station['coordinate'])})
        draw.text((3, 2 * CELL_HEIGHT), 'Esri Wayback 11019 / z17 | 3 px de pantalla = 1 px nativo | criterio: contacto visible arena-mar, 1-2 px nativos', font=font, fill='white')
        sheet.save(panel)
        panel_sha = sha(panel)
        rows.extend({**r, 'panel_sha256': panel_sha} for r in group)
    evidence = {'status': 'rendered_awaiting_visual_review', 'source_release': 11019,
                'source_capture_date': '2011-08-01', 'zoom': ZOOM, 'display_px_per_native_px': SCALE,
                'native_visual_tolerance_px': 2, 'longitude_limits': list(LON_RANGE),
                'field_validated': False,
                'tolerance_note': 'Visual coincidence within 1–2 original z17 tile pixels does not certify field positioning accuracy.',
                'source_footprints': relative(FOOTPRINTS), 'source_footprints_sha256': sha(FOOTPRINTS),
                'grid': relative(grid_path), 'grid_sha256': hashlib.sha256(raw).hexdigest(), 'rows': rows}
    (output / 'inventory.json').write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'stations': len(rows), 'panels': math.ceil(len(rows)/6), 'grid_sha256': evidence['grid_sha256'], 'output': relative(output)}))


def finish(output: Path, choices_path: Path, reviewer: str = 'dzemul_audit') -> None:
    evidence = json.loads((output / 'inventory.json').read_bytes())
    assert sha(ROOT / evidence['grid']) == evidence['grid_sha256'], 'Grid changed; render and inspect the new version.'
    assert sha(ROOT / evidence['source_footprints']) == evidence['source_footprints_sha256']
    decisions = json.loads(choices_path.read_bytes())
    assert decisions['grid_sha256'] == evidence['grid_sha256'], 'Visual choices must pin the inspected grid version.'
    choices = decisions['choices']
    assert set(choices) == {r['id'] for r in evidence['rows']}, 'Explicit visual decision required for every station.'
    rows = []
    checked_evidence = {}
    for r in evidence['rows']:
        for p, expected in [(r['panel'], r['panel_sha256']), *((t['path'], t['sha256']) for t in r['source_tiles'])]:
            if p not in checked_evidence:
                checked_evidence[p] = sha(ROOT / p)
            assert checked_evidence[p] == expected, f'Evidence changed after rendering: {p}'
        d = choices[r['id']]
        status = d['status']
        assert status in {'compatible_visible_contact', 'needs_adjustment', 'no_unique_visible_contact'}
        result = {**r, 'visual_status': status, 'visual_note': d.get('note')}
        if detail := d.get('detail_panel'):
            assert sha(ROOT / detail['path']) == detail['sha256']
            result['detail_panel'] = detail
        if status == 'needs_adjustment':
            dx, dy = d['proposed_native_pixel_delta']
            target_px = (r['world_pixel'][0] + dx, r['world_pixel'][1] + dy)
            proposed = coordinate(target_px)
            result.update(proposed_native_pixel_delta=[dx, dy], proposed_world_pixel=list(target_px),
                          proposed_coordinate=list(proposed), adjustment_m=GEOD.inv(*r['coordinate'], *proposed)[2],
                          proposed_coordinate_verified_photo=verify_photo(proposed))
        rows.append(result)
    result = {**evidence, 'status': 'independent_visual_review_complete', 'reviewer': reviewer,
              'stations_reviewed': len(rows), 'accepted': sum(r['visual_status'] == 'compatible_visible_contact' for r in rows),
              'needs_adjustment': sum(r['visual_status'] == 'needs_adjustment' for r in rows),
              'unresolved': sum(r['visual_status'] == 'no_unique_visible_contact' for r in rows),
              'reverified_evidence_files': len(checked_evidence),
              'decisions_sha256': sha(choices_path), 'rows': rows}
    (output / 'independent-review.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: result[k] for k in ('status', 'stations_reviewed', 'accepted', 'needs_adjustment', 'unresolved', 'grid_sha256')}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--grid', type=Path, default=GRID)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    parser.add_argument('--municipality', default=MUNICIPALITY)
    parser.add_argument('--tiles', type=Path, default=TILES)
    parser.add_argument('--footprints', type=Path, default=FOOTPRINTS)
    parser.add_argument('--longitude-range', nargs=2, type=float, default=LON_RANGE)
    parser.add_argument('--reviewer', default='dzemul_audit')
    parser.add_argument('--finish', type=Path, help='Compile explicit manual visual choices; does not alter the grid.')
    args = parser.parse_args()
    MUNICIPALITY, TILES, FOOTPRINTS, LON_RANGE = args.municipality, args.tiles, args.footprints, args.longitude_range
    if args.finish:
        finish(args.output, args.finish, args.reviewer)
    else:
        render(args.grid, args.output)
