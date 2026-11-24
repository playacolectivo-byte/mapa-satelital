"""Station approved 2011 beach controls at 100 m of WGS84 chainage.

This is a derived display grid, not new photographic interpretation or a
replacement of the original measured controls. Requires pyproj; makes no
network requests and never writes municipal/scientific source files.

Run with a Python environment containing pyproj::
    python scripts/build-coastal-100m-grid.py
"""
from __future__ import annotations

from bisect import bisect_right
from collections import Counter
from pathlib import Path
import argparse
import hashlib
import json
import math
import platform

import pyproj
from pyproj import Geod

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/data/shorelines/photo-alignment/coastal-100m-grid-20261106.json'
AUDIT = ROOT / 'docs/qa/coastal-100m-grid-audit-20261106.json'
SPACING_M = 100
MAX_EDGE_M = 180
MIN_AUXILIARY_EDGE_M = 45
GEOD = Geod(ellps='WGS84')
MUNICIPALITIES = [('progreso', 'Progreso'), ('hunucma', 'Hunucmá'), ('dzemul', 'Dzemul')]
INPUTS: dict[str, dict] = {}
REFINED_PATHS: list[dict] = []
NON_BARRIER_AUXILIARY_IDS: set[str] = set()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_input(relative: str) -> dict:
    path = ROOT / relative
    raw = path.read_bytes()
    INPUTS[relative] = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
    return json.loads(raw)


def unit(vector: list[float]) -> list[float]:
    length = math.hypot(*vector)
    assert math.isfinite(length) and length > 1e-8
    return [vector[0] / length, vector[1] / length]


def wgs84_axis(mercator_vector: list[float], latitude: float) -> list[float]:
    """Convert the source spherical-ground axis to local ellipsoidal ENU.

    Original offsets use Web Mercator with its spherical cos(latitude) scale.
    An east component therefore maps by N/a and a north component by M/a.
    This changes direction slightly; it does not move the approved point.
    """
    e2 = GEOD.f * (2 - GEOD.f)
    w = 1 - e2 * math.sin(math.radians(latitude)) ** 2
    n_over_a = 1 / math.sqrt(w)
    m_over_a = (1 - e2) / w ** 1.5
    return unit([mercator_vector[0] * n_over_a, mercator_vector[1] * m_over_a])


def distance(a: dict, b: dict) -> float:
    return GEOD.inv(*a['coordinate'], *b['coordinate'])[2]


def reference_coordinate(target: dict, offset_m: float) -> list[float]:
    # Preserve the application's existing manually approved point exactly.
    # Only subsequent stationing/distance calculation uses ellipsoidal Geod.
    lon, lat = target['p']
    radius = 6378137
    scale = math.cos(math.radians(lat))
    x = radius * math.radians(lon) + target['v'][0] * offset_m / scale
    y = radius * math.asinh(math.tan(math.radians(lat))) + target['v'][1] * offset_m / scale
    return [math.degrees(x / radius), math.degrees(math.atan(math.sinh(y / radius)))]


def control_summary(control: dict) -> dict:
    return {**{k: control[k] for k in ['id', 'coordinate', 'group', 'user_guide', 'auxiliary']},
            'source_axis_mercator': control['axis'],
            'axis': wgs84_axis(control['axis'], control['coordinate'][1])}


def point_on_segment(p: list, a: list, b: list) -> bool:
    cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
    return abs(cross) <= 1e-15 and min(a[0], b[0]) <= p[0] <= max(a[0], b[0]) and min(a[1], b[1]) <= p[1] <= max(a[1], b[1])


def segments_intersect(a: list, b: list, c: list, d: list) -> bool:
    if max(a[0], b[0]) < min(c[0], d[0]) or max(c[0], d[0]) < min(a[0], b[0]):
        return False
    if max(a[1], b[1]) < min(c[1], d[1]) or max(c[1], d[1]) < min(a[1], b[1]):
        return False
    def orientation(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    x1, x2, x3, x4 = orientation(a, b, c), orientation(a, b, d), orientation(c, d, a), orientation(c, d, b)
    return x1 * x2 < 0 and x3 * x4 < 0 or any([
        point_on_segment(c, a, b), point_on_segment(d, a, b),
        point_on_segment(a, c, d), point_on_segment(b, c, d),
    ])


def port_crossings(a: dict, b: dict, ports: list[dict]) -> list[str]:
    # Intersection is topological, with no degree-to-metre conversion or buffer.
    # Approved links are <=180 m; longitude/latitude chords and geodesics differ
    # by far less than the imagery interpretation tolerance at this scale.
    result = []
    for port in ports:
        if any(segments_intersect(a['coordinate'], b['coordinate'], c, d)
               for c, d in zip(port['coordinates'], port['coordinates'][1:])):
            result.append(port['id'])
    return result


def fill_original_gap(left: dict, right: dict, auxiliary: list[dict]) -> tuple[list[dict], dict]:
    """Choose a monotone, non-overlapping auxiliary route only in coverage gaps.

    Dynamic programming favours approximately 100 m edges, with a small
    shortest-path penalty to avoid alternating lateral duplicate controls.
    Original controls and user guides are never removed or displaced.
    """
    gap = distance(left, right)
    interior = [c for c in auxiliary if left['coordinate'][0] < c['coordinate'][0] < right['coordinate'][0]]
    info = {'left_profile_id': left['id'], 'right_profile_id': right['id'], 'original_gap_m': gap,
            'candidate_profile_ids': [c['id'] for c in interior], 'selected_profile_ids': []}
    if gap <= MAX_EDGE_M or not interior:
        info['decision'] = 'original_coverage_sufficient' if gap <= MAX_EDGE_M else 'no_auxiliary_coverage'
        return [], info
    eligible = [c for c in interior if distance(left, c) >= MIN_AUXILIARY_EDGE_M and distance(c, right) >= MIN_AUXILIARY_EDGE_M]
    nodes = [left, *eligible, right]
    costs = [float('inf')] * len(nodes)
    previous = [-1] * len(nodes)
    costs[0] = 0
    for j in range(1, len(nodes)):
        for i in range(j):
            edge = distance(nodes[i], nodes[j])
            if not MIN_AUXILIARY_EDGE_M <= edge <= MAX_EDGE_M:
                continue
            cost = costs[i] + ((edge - SPACING_M) / SPACING_M) ** 2 + edge / 10000
            if cost < costs[j]:
                costs[j], previous[j] = cost, i
    if math.isfinite(costs[-1]):
        indices, index = [], len(nodes) - 1
        while previous[index] >= 0:
            index = previous[index]
            if index:
                indices.append(index)
        chosen = [nodes[i] for i in reversed(indices)]
        info['decision'] = 'auxiliary_route_fills_original_gap'
    else:
        # A missing stretch remains a hard gap. Preserve interpretable coastal
        # fragments on either side rather than extrapolating a connection.
        chosen = []
        for candidate in eligible:
            prior = chosen[-1] if chosen else left
            if distance(prior, candidate) >= 80 and distance(candidate, right) >= MIN_AUXILIARY_EDGE_M:
                chosen.append(candidate)
        info['decision'] = 'partial_auxiliary_coverage_remaining_gap_preserved'
    info['selected_profile_ids'] = [c['id'] for c in chosen]
    return chosen, info


def station_segment(slug: str, municipality: str, number: int, controls: list[dict]) -> tuple[dict, dict]:
    segment_id = f'grid100-{slug}-{number:03d}'
    geometry = [controls[0]['coordinate']]
    original_geometry_indices = [0]
    for left, right in zip(controls, controls[1:]):
        vertices = []
        for path in REFINED_PATHS:
            if path['municipality'] != municipality:
                continue
            points = path['coordinates']
            if points[0][0] <= left['coordinate'][0] + 1e-10 and right['coordinate'][0] <= points[-1][0] + 1e-10:
                vertices.extend(p for p in points if left['coordinate'][0] < p[0] < right['coordinate'][0])
        geometry.extend(sorted(vertices, key=lambda p: p[0]))
        geometry.append(right['coordinate'])
        original_geometry_indices.append(len(geometry) - 1)
    cumulative = [0.0]
    for a, b in zip(geometry, geometry[1:]):
        cumulative.append(cumulative[-1] + GEOD.inv(*a, *b)[2])
    control_cumulative = [cumulative[i] for i in original_geometry_indices]
    stations, checks = [], []
    for ordinal in range(math.floor((cumulative[-1] + 1e-8) / SPACING_M) + 1):
        chainage = ordinal * SPACING_M
        vertex = next((i for i, s in enumerate(control_cumulative) if abs(s - chainage) < 1e-8), None)
        if vertex is not None:
            left = right = controls[vertex]
            fraction, coordinate, reconstructed = 0.0, list(left['coordinate']), control_cumulative[vertex]
            axis = wgs84_axis(left['axis'], coordinate[1])
        else:
            index = bisect_right(cumulative, chainage) - 1
            a, b = geometry[index:index + 2]
            control_index = min(bisect_right(control_cumulative, chainage) - 1, len(controls) - 2)
            left, right = controls[control_index:control_index + 2]
            azimuth, _, edge = GEOD.inv(*a, *b)
            within = chainage - cumulative[index]
            fraction = (chainage - control_cumulative[control_index]) / (control_cumulative[control_index + 1] - control_cumulative[control_index])
            lon, lat, _ = GEOD.fwd(*a, azimuth, within)
            coordinate = [lon, lat]
            source_axis = [left['axis'][k] * (1 - fraction) + right['axis'][k] * fraction for k in range(2)]
            axis = wgs84_axis(source_axis, coordinate[1])
            actual_within = GEOD.inv(*a, *coordinate)[2]
            reconstructed = cumulative[index] + actual_within
            edge_reconstructed = actual_within + GEOD.inv(*coordinate, *b)[2]
            assert abs(edge_reconstructed - edge) < .001
        assert abs(reconstructed - chainage) <= .001
        assert abs(math.hypot(*axis) - 1) < 1e-12
        stations.append({'id': f'GRID100-{slug}-{number:03d}-{ordinal:04d}', 'chainage_m': chainage,
                         'coordinate': coordinate, 'left_profile_id': left['id'], 'right_profile_id': right['id'],
                         'fraction': fraction, 'axis': axis,
                         'control_reference_coordinates': [left['coordinate'], right['coordinate']]})
        checks.append({'id': stations[-1]['id'], 'chainage_error_m': reconstructed - chainage})
    chord_distances = [GEOD.inv(*a['coordinate'], *b['coordinate'])[2] for a, b in zip(stations, stations[1:])]
    turns = []
    for a, b, c in zip(controls, controls[1:], controls[2:]):
        az1 = GEOD.inv(*a['coordinate'], *b['coordinate'])[0]
        az2 = GEOD.inv(*b['coordinate'], *c['coordinate'])[0]
        turn = abs((az2 - az1 + 180) % 360 - 180)
        turns.append({'profile_id': b['id'], 'turn_degrees': turn})
    audit = {'id': segment_id, 'municipality': municipality, 'length_m': cumulative[-1],
             'controls': [{**control_summary(c), 'chainage_m': s} for c, s in zip(controls, control_cumulative)],
             'reference_geometry_vertices': len(geometry),
             'stations': len(stations), 'maximum_chainage_reconstruction_error_m': max(abs(c['chainage_error_m']) for c in checks),
             'minimum_adjacent_station_chord_m': min(chord_distances, default=None),
             'maximum_adjacent_station_chord_m': max(chord_distances, default=None),
             'maximum_control_turn_degrees': max((t['turn_degrees'] for t in turns), default=0),
             'turns_over_30_degrees': [t for t in turns if t['turn_degrees'] > 30],
             'tail_after_last_station_m': cumulative[-1] - stations[-1]['chainage_m']}
    return {'id': segment_id, 'municipality': municipality, 'reference_geometry': geometry, 'stations': stations}, audit


def traced_between(municipality: str, left: dict, right: dict) -> bool:
    return any(path['municipality'] == municipality
               and path['coordinates'][0][0] <= left['coordinate'][0] + 1e-10
               and right['coordinate'][0] <= path['coordinates'][-1][0] + 1e-10
               for path in REFINED_PATHS)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage-controls', action='store_true')
    parser.add_argument('--stage-geometry', action='store_true')
    parser.add_argument('--regional-plan', type=Path,
                        help='Build a private grid from reviewed municipal photo payloads and detailed geometry.')
    args = parser.parse_args()
    assert sum(map(bool, (args.stage_controls, args.stage_geometry, args.regional_plan))) <= 1
    regional = read_input(args.regional_plan.as_posix()) if args.regional_plan else None
    stage = ROOT / 'work/chicxulub-reference-review-20261106'
    staging = args.stage_controls or args.stage_geometry
    stage_prefix = 'grid-geometry-stage' if args.stage_geometry else 'grid-stage'
    output = args.regional_plan.parent / 'grid.json' if regional else stage / (stage_prefix+'.json') if staging else OUTPUT
    audit_output = output.with_name('grid-audit.json') if regional else stage / (stage_prefix+'-audit.json') if staging else AUDIT
    refinement_path = stage / ('geometry-stage.json' if args.stage_geometry else 'controls-stage.json') if staging else ROOT / 'public/data/shorelines/photo-alignment/reference-refinement-20261106.json'
    refinement = None
    if regional:
        REFINED_PATHS.extend(regional['reference_geometry'])
        NON_BARRIER_AUXILIARY_IDS.update(regional.get('non_barrier_auxiliary_ids', []))
    elif refinement_path.exists():
        refinement = read_input(str(refinement_path.relative_to(ROOT)).replace('\\', '/'))
        assert refinement['status'] == 'independently_reviewed'
        REFINED_PATHS.extend(refinement.get('reference_geometry', []))
        NON_BARRIER_AUXILIARY_IDS.update(refinement.get('non_barrier_auxiliary_ids', []))
    guides = read_input('public/data/shorelines/photo-alignment/user-guides-2011-20261105.json')
    guide_ids = set() if regional else {c['profile_id'] for c in guides['corrections']}
    assert regional or len(guide_ids) == 47
    coast = read_input('public/data/coast.geojson')
    ports = [{'id': f['properties']['record_id'], 'coordinates': f['geometry']['coordinates']}
             for f in coast['features'] if f['properties'].get('SUBTIPO') == 'Construcción portuaria' and f['geometry']['type'] == 'LineString']
    grid = {'version': 1, 'spacing_m': SPACING_M, 'method': 'wgs84-2011-chainage-100m-v1', 'segments': []}
    report = {'version': 1, 'status': 'geodesic_grid_generated_pending_independent_review', 'method': grid['method'],
              'spacing_m': SPACING_M, 'chainage_tolerance_m': .001,
              'coordinate_order': ['longitude_degrees', 'latitude_degrees'],
              'ellipsoid': {'name': 'WGS84', 'semi_major_axis_m': GEOD.a, 'flattening': GEOD.f},
              'runtime': {'python': platform.python_version(), 'pyproj': pyproj.__version__, 'proj': pyproj.proj_version_str},
              'policy': {'original_controls_take_precedence': True, 'all_47_user_guides_are_mandatory_controls': True,
                         'auxiliary_controls_only_in_original_gaps_over_m': MAX_EDGE_M,
                         'minimum_auxiliary_control_edge_m': MIN_AUXILIARY_EDGE_M,
                         'maximum_permitted_final_control_edge_m': MAX_EDGE_M,
                         'non_barrier_auxiliary_ids': sorted(NON_BARRIER_AUXILIARY_IDS),
                         'axis': 'Original seaward v vectors are linearly interpolated at the geodesic fraction, converted from spherical-ground Web Mercator to local WGS84 ENU [N/a*vx,M/a*vy] at the station latitude, and normalized.',
                         'exact_control_station': 'left_profile_id equals right_profile_id; fraction is zero.',
                         'boundaries': 'Municipalities separate; absent or unreviewable 2011 controls, port-line intersections and residual gaps are never connected.',
                         'structures': 'Only unreviewable 2011 structural reference locations and port crossings; not every structure mapped in 2026.'},
              'limitations': ['100 m refers to ellipsoidal chainage along the 2011 reference geometry, not the straight chord across a bend.',
                              'Millimetre tolerance validates numerical stationing, not physical or photographic coastline accuracy.',
                              'Reviewed segments in Chelem and Chicxulub include digitized vertices from the 2011 photo. Other edges are interpolated between approved controls.',
                              'Municipal/scientific source coordinates, readings, guide corrections and acceptance flags are not modified.'],
              'municipalities': [], 'segments': [], 'rejected_controls': [], 'cuts': []}
    protected_used = set()
    municipalities = [(scope['slug'], scope['municipality']) for scope in regional['scopes']] if regional else MUNICIPALITIES
    for slug, municipality in municipalities:
        model = read_input(f'public/data/municipalities/{slug}/scenario.json')
        if regional:
            photos_path = ROOT / next(scope['photos'] for scope in regional['scopes'] if scope['slug'] == slug)
        else:
            photos_path = stage / 'photos-stage.json' if staging and slug == 'progreso' else ROOT / f'public/data/municipalities/{slug}/photos.json'
        photos = read_input(str(photos_path.relative_to(ROOT)).replace('\\', '/'))
        if not regional:
            overlay_name = 'manual-progreso-full' if slug == 'progreso' else f'manual-{slug}'
            read_input(f'public/data/shorelines/photo-alignment/{overlay_name}-20261105.json')
        references = {r['id']: {'capture': r['fixed_reference']['capture']} for r in photos['targets'] if r.get('fixed_reference')}
        gap_reasons = {r['id']: r['reference_unavailable']['reason'] for r in photos['targets'] if r.get('reference_unavailable')}
        photo_rows = {r['id']: r for r in photos['targets']}
        approved, barriers, rejected = [], [], []
        for target in model['targets']:
            row = photo_rows[target['id']]
            if not target['type'].startswith('Playa') and not (regional and row.get('reviewed_beach_control')):
                continue
            ref = references.get(target['id'])
            if ref is None:
                reason = gap_reasons.get(target['id'], 'no_manually_approved_2011_reference')
                rejected.append({'municipality': municipality, 'profile_id': target['id'], 'group': target['id'].split('-')[1], 'reason': reason})
                if (regional or 'structure' in reason or 'ambiguous_inlet' in reason) and target['id'] not in NON_BARRIER_AUXILIARY_IDS:
                    barriers.append({'profile_id': target['id'], 'longitude': target['p'][0], 'reason': reason})
                continue
            reference_capture = row.get('review_policy', {}).get('reference_capture', -1)
            assert reference_capture == ref['capture'] >= 0, target['id']
            reading = next(r for r in row['readings'] if r['capture'] == reference_capture)
            capture = photos['captures'][reference_capture]
            assert capture['date'].startswith('2011-') and reading['accepted'] and reading['offset_m'] is not None and reading.get('manual_review'), target['id']
            approved.append({'id': target['id'], 'coordinate': reference_coordinate(target, reading['offset_m']),
                             'axis': unit(target['v']), 'group': target['id'].split('-')[1],
                             'user_guide': target['id'] in guide_ids, 'auxiliary': 'cartographic_feature' in target,
                             'reference_capture': reference_capture, 'reference_date': capture['date']})
        approved.sort(key=lambda c: (c['coordinate'][0], c['coordinate'][1], c['id']))
        original = [c for c in approved if not c['auxiliary'] or c['user_guide']]
        auxiliary = [c for c in approved if c['auxiliary'] and not c['user_guide']]
        assert original
        selected = [original[0]]
        gap_decisions = []
        for left, right in zip(original, original[1:]):
            fill, decision = fill_original_gap(left, right, auxiliary)
            gap_decisions.append(decision)
            selected.extend(fill)
            selected.append(right)
        selected_ids = {c['id'] for c in selected}
        for control in auxiliary:
            if control['id'] not in selected_ids:
                original_nearest = min(distance(control, c) for c in original)
                selected_nearest = min(distance(control, c) for c in selected)
                rejected.append({'municipality': municipality, 'profile_id': control['id'], 'group': control['group'],
                                 'reason': 'auxiliary_redundant_original_coverage' if original_nearest < MAX_EDGE_M else 'auxiliary_overlap_or_inferior_gap_route',
                                 'nearest_original_distance_m': original_nearest, 'nearest_selected_distance_m': selected_nearest})
        # No selected source point is reordered westward or shifted to regularize
        # spacing. Only the derived stations are regularly spaced.
        assert all(a['coordinate'][0] <= b['coordinate'][0] for a, b in zip(selected, selected[1:]))
        groups = [[selected[0]]]
        for left, right in zip(selected, selected[1:]):
            gap = distance(left, right)
            crossing = [p for p in barriers if left['coordinate'][0] <= p['longitude'] <= right['coordinate'][0]]
            port_ids = port_crossings(left, right, ports)
            reasons = ([] if gap <= MAX_EDGE_M else ['control_gap_over_180m']) + ([] if not crossing else ['unreviewable_2011_reference_between_controls']) + ([] if not port_ids else ['port_geometry_intersection'])
            if regional:
                if left['reference_capture'] != right['reference_capture']:
                    reasons.append('different_2011_captures')
                if not traced_between(municipality, left, right):
                    reasons.append('no_continuous_reviewed_2011_trace')
            if reasons:
                report['cuts'].append({'municipality': municipality, 'left_profile_id': left['id'], 'right_profile_id': right['id'],
                                       'geodesic_gap_m': gap, 'reasons': reasons, 'unreviewable_2011_controls': crossing, 'port_record_ids': port_ids})
                groups.append([right])
            else:
                groups[-1].append(right)
        municipality_segments = []
        for number, controls in enumerate(groups, 1):
            segment, audit = station_segment(slug, municipality, number, controls)
            if regional:
                segment['method_url'] = regional['method_url']
            grid['segments'].append(segment)
            report['segments'].append(audit)
            municipality_segments.append(segment)
        protected_used.update(c['id'] for c in selected if c['user_guide'])
        report['rejected_controls'].extend(rejected)
        report['municipalities'].append({'municipality': municipality, 'approved_2011_candidates': len(approved),
                                         'original_controls_used': len(original), 'auxiliary_candidates': len(auxiliary),
                                         'auxiliary_controls_used': len(selected) - len(original), 'user_guides_preserved': sum(c['user_guide'] for c in selected),
                                         'selected_controls': len(selected), 'segments': len(groups),
                                         'stations': sum(len(s['stations']) for s in municipality_segments),
                                         'first_control': control_summary(selected[0]), 'last_control': control_summary(selected[-1]),
                                         'gap_route_decisions': [d for d in gap_decisions if d['original_gap_m'] > MAX_EDGE_M],
                                         'rejected_by_group_and_reason': [{'group': g, 'reason': reason, 'count': count}
                                                                          for (g, reason), count in sorted(Counter((r['group'], r['reason']) for r in rejected).items())]})
    assert protected_used == guide_ids
    station_ids = [s['id'] for segment in grid['segments'] for s in segment['stations']]
    assert len(station_ids) == len(set(station_ids))
    for relative, receipt in INPUTS.items():
        assert sha256(ROOT / relative) == receipt['sha256'], f'Input changed during build: {relative}'
    report['inputs'] = INPUTS
    report['counts'] = {'segments': len(grid['segments']), 'stations': len(station_ids),
                        'user_guide_controls_preserved': len(protected_used), 'excluded_controls': len(report['rejected_controls'])}
    report['maximum_chainage_reconstruction_error_m'] = max(s['maximum_chainage_reconstruction_error_m'] for s in report['segments'])
    output_bytes = (json.dumps(grid, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    report['artifact'] = {'path': str(output.resolve().relative_to(ROOT)), 'sha256': hashlib.sha256(output_bytes).hexdigest(), 'bytes': len(output_bytes)}
    if not staging and refinement is not None:
        review = refinement['visual_grid_review']
        assert report['artifact']['sha256'] == review['grid_sha256'], 'Regenerated coordinates differ from the visually reviewed grid'
        report['status'] = 'geodesic_grid_generated_chicxulub_stations_visually_checked'
        report['visual_grid_review'] = review
    for destination, content in [(output, output_bytes), (audit_output, (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))]:
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(destination.suffix + '.tmp')
        temporary.write_bytes(content)
        temporary.replace(destination)
    print(json.dumps({'artifact': report['artifact'], 'counts': report['counts'],
                      'maximum_chainage_error_m': report['maximum_chainage_reconstruction_error_m'],
                      'municipalities': [{k: m[k] for k in ['municipality', 'selected_controls', 'auxiliary_controls_used', 'segments', 'stations']} for m in report['municipalities']]}, ensure_ascii=False))


if __name__ == '__main__':
    main()
