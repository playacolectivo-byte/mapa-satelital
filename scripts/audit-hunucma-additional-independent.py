"""Pin the independently inspected 394-reading Hunucma supplement and its evidence.

The visual observations are explicit reviewing-agent decisions: 388 contacts in
the retained cross sheets, four additional contacts in native 2-D context, and
two genuinely unresolvable contacts.  This script checks their provenance and
geometry; it does not infer or approve a shoreline from colour or metadata.
"""
from pathlib import Path
from collections import Counter
import datetime as dt
import hashlib
import json
import math

from pyproj import Transformer, Geod
from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / 'work/hunucma-additional-review-20261106'
OWN = ROOT / 'work/dzemul-audit-20261105/hunucma-additional-independent'

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

package_path = QA / 'approved-additional.json'
package = read(package_path)
proposals_path = QA / 'additional-proposals.json'
proposals = read(proposals_path)
inventory_path = QA / 'unreviewed-inventory.json'
inventory = read(inventory_path)
assert digest(inventory_path) == proposals['source_inventory_sha256']
assert len(package['states']) == len(proposals['rows']) == len(inventory['rows']) == 394
photos_path = ROOT / 'public/data/municipalities/hunucma/photos.json'
assert digest(photos_path) == package['source_photos_sha256'] == proposals['source_photos_sha256']
photos = read(photos_path)
photo_rows = {r['id']: r for r in photos['targets']}
main = read(ROOT / 'public/data/shorelines/photo-alignment/manual-hunucma-20261105.json')
bases = {c['profile_id']: c['offset_m'] for c in main['corrections'] if c['capture'] == 40}
previously_reviewed = {(r['profile_id'], r['capture']) for r in main['reviewed_readings']}
identities = {(r['profile_id'], r['capture']) for r in package['states']}
assert len(identities) == 394 and identities.isdisjoint(previously_reviewed)

# The 388 source-centred final choices were each inspected before the four
# native-context recoveries.  Pin that retained inspection, not regenerated
# sheets with a different order after the recoveries.
observed = read(OWN / 'input.json')
assert observed['annotated'] == 388
old_observations = {r['state']['display_index']: r for r in observed['records']}
recoveries = {70: 626, 113: 389, 375: 411, 376: 402}
unresolvable = {6, 360}
seams = {102, 131, 132, 133, 203, 204}
assert len(old_observations) == 388

manifest = read(QA / 'source-manifest.json')
features = {}
metadata_evidence = []
for release, item in manifest.items():
    path = ROOT / item['path']
    assert digest(path) == item['sha256']
    response = read(path)
    assert response['spatialReference']['wkid'] == 4326
    features[int(release)] = [(f['attributes'], [Polygon(ring) for ring in f['geometry']['rings']]) for f in response['features']]
    metadata_evidence.append({'release': int(release), 'path': item['path'], 'sha256': item['sha256'], 'url': item['url'], 'features': len(response['features'])})

source_evidence = []
tile_count = 0
for release, item in read(QA / 'source-samples.json').items():
    manifest_path = ROOT / item['manifest']
    assert digest(manifest_path) == item['manifest_sha256']
    assert digest(ROOT / item['mosaic']) == item['mosaic_sha256']
    native_manifest = read(manifest_path)
    assert native_manifest['zoom'] == item['native_tile_zoom'] == 17
    assert native_manifest['tiles'] == item['original_tiles']
    for tile in item['original_tiles']:
        tile_path = manifest_path.parent / 'tiles' / f'17-{tile["x"]}-{tile["y"]}.jpg'
        assert digest(tile_path) == tile['sha256']
        assert f'/tile/{release}/17/{tile["y"]}/{tile["x"]}' in tile['url']
        tile_count += 1
    source_evidence.append({'release': int(release), 'native_tiles': len(item['original_tiles']), 'manifest': item['manifest'], 'manifest_sha256': item['manifest_sha256'], 'mosaic': item['mosaic'], 'mosaic_sha256': item['mosaic_sha256']})

sources = {s['id']: s for s in package['sources']}
corrections = {(c['profile_id'], c['capture']): c for c in package['corrections']}
rejects = {(r['profile_id'], r['capture']): r for r in package['rejected_readings']}
to_web = Transformer.from_crs(4326, 3857, always_xy=True)
to_geo = Transformer.from_crs(3857, 4326, always_xy=True)
geod = Geod(ellps='WGS84')
records = []
max_coordinate_residual = 0.0
panel_hashes = {}

def pin_image(path, expected=None):
    if path not in panel_hashes:
        panel_hashes[path] = digest(ROOT / path)
    if expected:
        assert panel_hashes[path] == expected
    return panel_hashes[path]

for n, (state, original) in enumerate(zip(package['states'], proposals['rows'])):
    assert state['display_index'] == original['display_index'] == n
    assert all(state[k] == v for k, v in original.items())
    identity = (state['profile_id'], state['capture'])
    current = next(r for r in photo_rows[state['profile_id']]['readings'] if r['capture'] == state['capture'])
    assert current == state['previous']
    assert state['reference_capture'] == 40 and bases[state['profile_id']] == state['baseline_offset_m']
    pin_image(state['evidence_panel'], state['evidence_panel_sha256'])
    record = {k: state[k] for k in ['display_index', 'profile_id', 'capture', 'date', 'release', 'status']}
    record.update(reference_capture=40, source_panel=state['evidence_panel'], source_panel_sha256=state['evidence_panel_sha256'], independent_reviewer='dzemul_audit', final_accepted=identity in corrections)
    if n in unresolvable:
        assert state.get('source_id') is None and identity not in corrections and identity not in rejects
        context = str((QA / f'context-pending-{n:03}.png').relative_to(ROOT))
        record.update(visual_status='unresolved_visible_contact', context_panel=context, context_panel_sha256=pin_image(context), offset_m=None)
        records.append(record)
        continue
    source = sources[state['source_id']]
    assert source['panel'] == state['evidence_panel']
    assert source['panel_pixel'] == [state['panel_pixel_x'], state['visual_choice']]
    assert source['screenshot_sha256'] == state['evidence_panel_sha256']
    assert state['proposed_offset_m'] == (345 - state['visual_choice']) / 2
    if n in old_observations:
        before = old_observations[n]
        assert before['state']['visual_choice'] == state['visual_choice']
        assert before['state']['proposed_offset_m'] == state['proposed_offset_m']
        cross = str((OWN / before['cross_panel']).relative_to(ROOT))
        record.update(independent_panel=cross, independent_panel_sha256=pin_image(cross))
    else:
        assert recoveries[n] == state['visual_choice']
        context = str((QA / f'context-pending-{n:03}.png').relative_to(ROOT))
        record.update(context_panel=context, context_panel_sha256=pin_image(context), recovery_second_view='native_2d_confirmed_by_both_reviewing_agents')
    manual = str((QA / f'manual-{n // 14 * 14:03}.png').relative_to(ROOT))
    record.update(manual_panel=manual, manual_panel_sha256=pin_image(manual))
    x, y = to_web.transform(*state['p'])
    factor = math.cos(math.radians(state['p'][1]))
    reconstructed = to_geo.transform(x + state['v'][0] * state['proposed_offset_m'] / factor, y + state['v'][1] * state['proposed_offset_m'] / factor)
    residual = geod.inv(*reconstructed, *state['coordinate'])[2]
    assert residual < 0.0001 and state['coordinate'] == source['coordinate']
    max_coordinate_residual = max(max_coordinate_residual, residual)
    point = Point(state['coordinate'])
    covering = [attrs for attrs, rings in features[state['release']] if sum(ring.covers(point) for ring in rings) % 2]
    actual = [{'date': dt.datetime.fromtimestamp(a['SRC_DATE2'] / 1000, dt.timezone.utc).date().isoformat(), 'sensor': a['SRC_DESC']} for a in covering]
    valid = len(actual) == 1 and actual[0] == {'date': state['date'], 'sensor': state['source']['source']}
    item = manifest[str(state['release'])]
    assert source['metadata_sha256'] == item['sha256'] and source['metadata_url'] == item['url']
    assert source['metadata_endpoint_verified'] == valid and source['covering_footprints'] == len(covering)
    assert valid == (identity in corrections)
    if n in seams:
        assert not valid and identity in rejects
        assert rejects[identity]['releases'] == [state['release']]
    else:
        assert valid and identity not in rejects
        c = corrections[identity]
        assert c['offset_m'] == state['proposed_offset_m'] and c['manual_uncertainty_m'] == 8
        assert c['original_offset_m'] == current['offset_m'] and c['original_accepted'] == current['accepted']
    record.update(visual_status='compatible_visible_water_sand_contact', offset_m=state['proposed_offset_m'], coordinate=state['coordinate'], coordinate_residual_m=residual, source_panel_pixel=source['panel_pixel'], metadata_sha256=item['sha256'], metadata_url=item['url'], expected_sensor=state['source']['source'], actual_covering_sources=actual, exact_source_identity_verified=valid)
    records.append(record)

assert len(records) == 394 and sum(r['final_accepted'] for r in records) == 386
assert set(r['display_index'] for r in records if not r['final_accepted']) == seams | unresolvable
assert len(corrections) == 386 and len(package['pending_readings']) == 8 and len(rejects) == 6
alternate_path = QA / 'alternate-source-checks.json'
alternate = read(alternate_path)
assert alternate['readings'] == 6 and alternate['endpoint_release_checks'] == 11
for check in alternate['records']:
    path = ROOT / check['metadata_path']
    assert digest(path) == check['metadata_sha256'] and check['valid_for_expected_capture'] is False
    point = Point(check['coordinate'])
    response = read(path)
    covering = [f['attributes'] for f in response['features'] if sum(Polygon(ring).covers(point) for ring in f['geometry']['rings']) % 2]
    assert len(covering) == 1
    attrs = covering[0]
    assert (dt.datetime.fromtimestamp(attrs['SRC_DATE2'] / 1000, dt.timezone.utc).date().isoformat(), attrs['SRC_DESC']) != (check['expected_date'], check['expected_sensor'])

report = {
    'status': 'independent_visual_review_complete',
    'review_date': '2026-11-06',
    'reviewer': 'dzemul_audit',
    'primary_reviewer': 'hunucma_audit',
    'field_validated': False,
    'readings_reviewed': 394,
    'visible_contacts_independently_examined': 392,
    'approved_source_verified': 386,
    'pending_readings': 8,
    'pending_visual': 2,
    'pending_source_seams': 6,
    'clear_unresolved_discrepancies_above_operational_8m': 0,
    'approved_additional_sha256': digest(package_path),
    'approved_additional_status': package['status'],
    'source_photos_sha256': package['source_photos_sha256'],
    'proposal_inventory_sha256': digest(proposals_path),
    'retained_original_388_cross_inspection_manifest_sha256': digest(OWN / 'input.json'),
    'original_tile_hashes_verified': tile_count,
    'exact_metadata_responses_verified': len(metadata_evidence),
    'max_reconstructed_coordinate_residual_m': max_coordinate_residual,
    'nominal_2011_reference_profiles': len(set(r['profile_id'] for r in records)),
    'year_counts': dict(sorted(Counter(r['date'][:4] for r in records).items())),
    'four_native_context_recoveries': list(recoveries),
    'all_six_source_seams_preserved_as_pending': True,
    'source_seam_alias_checks': {'path': str(alternate_path.relative_to(ROOT)), 'sha256': digest(alternate_path), 'endpoint_release_checks': 11},
    'operational_interpretation_tolerance_m': 8,
    'limitations': ['Eight metres is an operational visible-edge interpretation tolerance, not a standard uncertainty or certified physical accuracy.', 'No general tide, wave runup, beach slope, or image registration correction was possible from these RGB photos.', 'Metadata dates and sensor identities are checked at the final corrected endpoint; release publication years are not acquisition dates.', 'Two plume/vegetation/channel contacts and six source-date seams remain pending without an accepted measurement.'],
    'metadata_evidence': metadata_evidence,
    'native_source_evidence': source_evidence,
    'image_evidence': [{'path': path, 'sha256': sha} for path, sha in sorted(panel_hashes.items())],
    'records': records,
}
destination = ROOT / 'docs/qa/hunucma-additional-independent-review-20261106.json'
destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: report[k] for k in ['status', 'readings_reviewed', 'approved_source_verified', 'pending_readings', 'approved_additional_sha256', 'original_tile_hashes_verified', 'max_reconstructed_coordinate_residual_m']}))
