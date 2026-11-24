import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { temporalEvidence, resolveTemporalRecord, studyMatchesCapture, createTemporalEvidenceResolver, groynesForStudyYear } from '../lib/temporal-evidence.ts';

const json = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const registry = json('public/data/problems/temporal-observations.json');
const original = json('public/data/problems/geotube-historical-axes.geojson');
const originalText = JSON.stringify(original);
const layers = { barriers: null, geotubes: original, groynes: null, vegetation: null };
const at = (key, date = null, center = [-89.55525, 21.30735]) => ({ key, date, center, source: key.startsWith('study:') ? 'study' : 'esri' });
const states = frame => temporalEvidence(layers, frame, registry, false);

assert.equal(registry.records.length, 6);
assert.equal(registry.records.flatMap(r => r.observations).length, 54);
const before = states(at('esri:10768'));
assert.equal(before.counts.absent, 6, '2015 capture predates these particular 2017 works');
assert.equal(before.layers.geotubes.features.length, 0);

const flight = states(at('study:san-miguel-flight-2018-04-11'));
assert.equal(flight.layers.geotubes.features.length, 6);
assert.equal(flight.layers.geotubes.features.filter(f => f.properties.temporal_state === 'present').length, 2);
assert.equal(flight.layers.geotubes.features.filter(f => f.properties.temporal_state === 'deflated').length, 4);
assert.deepEqual(flight.layers.geotubes.features.filter(f => f.properties.temporal_state === 'present').map(f => f.id), ['SANMIGUEL-TF2019-AXIS-02', 'SANMIGUEL-TF2019-AXIS-03']);

// Author observations are snapshots, never invented continuous annual lifetimes.
assert.equal(states(at('study:campaign-2017-06-28', '2017-06-28')).counts.visible, 3);
assert.equal(states(at('study:campaign-2017-08-30', '2017-08-30')).counts.visible, 6);
const deflated = states(at('study:campaign-2018-06-13', '2018-06-13'));
assert.equal(deflated.counts.visible, 6, 'Deflation does not establish complete fabric removal');
assert(deflated.layers.geotubes.features.every(f => f.properties.temporal_state === 'deflated'));
assert.equal(states(at('esri:26334')).counts.unknown, 6, '2025 is not silently inferred from 2018');
assert.equal(states(at('esri:26334')).counts.visible, 0);
assert.equal(states(at('esri:unreviewed-edition')).counts.visible, 0, 'A new slider frame clears the previous marks before metadata arrives');
assert.equal(states(at('study:unknown', '2018-04-11', [-89.74, 21.27])).counts.unknown, 6, 'A capture date from another locality cannot be transferred');
assert.equal(resolveTemporalRecord(undefined, at('esri:26334'), registry).state, 'unknown');

assert.equal(temporalEvidence(layers, at('esri:10768'), registry, true).counts.visible, 0, 'Display approval must not resurrect works known to be absent before construction');
const refs = temporalEvidence(layers, at('esri:26334'), registry, true);
assert.equal(refs.counts.visible, 6);
assert(refs.layers.geotubes.features.every(f => f.properties.temporal_state === 'reference'));
assert.equal(studyMatchesCapture('2016–2021', at('test', '2018-04-11')), true);
assert.equal(studyMatchesCapture('2016–2021', at('test', '2025-03-13')), false);
assert.equal(studyMatchesCapture('2016–2021', at('test')), false);
assert.equal(JSON.stringify(original), originalText, 'Filtering must preserve received geometries and properties');
console.log('Temporal evidence: 54 dated observations; chronology, missing-date, locality, deflation, references and study-period checks passed.');

const observed = json('public/data/problems/geotube-dated-observations.json');
assert.equal(observed.features.length, 12);
assert.deepEqual(
  observed.features.filter(feature => feature.properties.municipality_slug === 'ixil')
    .map(feature => feature.properties.capture_date),
  ['2025-10-11', '2025-11-25'],
);
const renderObserved = createTemporalEvidenceResolver({ ...layers, geotubes: observed }, registry, true);
const matchedRaster = at('esri:26334', '2025-11-25');
const onRaster = release => observed.features.filter(f => f.properties.capture_release === release);
assert.deepEqual(
  renderObserved(matchedRaster).layers.geotubes.features.map(feature => feature.properties.temporal_date),
  onRaster(26334).map(feature => feature.properties.capture_date),
  'The local capture dates come from the evidence for each feature',
);
const observedFebruary = renderObserved(at('esri:22252', '2025-02-13')).layers.geotubes.features;
assert.deepEqual(observedFebruary.map(f => f.id), onRaster(22252).map(f => f.id));
assert.equal(observedFebruary.length, 5);
assert(observedFebruary.every(f => f.properties.temporal_date === '2025-02-13' && f.properties.temporal_state === 'present'));
assert.equal(renderObserved({ ...matchedRaster, source: 'sentinel' }).layers.geotubes.features.length, 0);
assert.equal(renderObserved(null).layers.geotubes.features.length, 0);
assert.equal(renderObserved(matchedRaster).layers.geotubes.features.length, 7);
console.log('The twelve dated geotube axes appear on their documented Esri mosaics.');

const groynes = json('public/data/problems/groyne-dated-observations.json');
assert(groynes.features.length >= 18);
assert.equal(new Set(groynes.features.map(feature => feature.id)).size, groynes.features.length);
assert(groynes.features.every(feature => feature.geometry.type === 'LineString' &&
  feature.properties.municipality_slug === 'progreso'));
assert(groynes.features.filter(feature =>
  feature.properties.locality === 'Chelem' && feature.properties.capture_date === '2025-02-13').length >= 6);
assert(groynes.features.filter(feature =>
  feature.properties.locality === 'Chuburná' && feature.properties.capture_date === '2025-03-23').length >= 12);
for(const [release,date,year] of [[11019,'2011-08-01',2011],[27946,'2012-12-15',2012],[18820,'2014-09-18',2014],[18820,'2015-03-26',2015],[20753,'2019-11-27',2019],[17825,'2020-06-07',2020],[64776,'2022-09-25',2022],[25285,'2023-09-21',2023],[26334,'2025-04-14',2025],[26334,'2026-02-07',2026]]){
  const dated = groynesForStudyYear(groynes,year);
  assert(dated.features.length > 0, String(year));
  const render = createTemporalEvidenceResolver({ ...layers, groynes: dated }, registry, false);
  const found = render(at('esri:'+release,date)).layers.groynes.features;
  const eligible = dated.features.filter(({properties:p})=>p.capture_release===release||(p.capture_equivalent_releases??[]).includes(release));
  assert(eligible.length > 0, String(year));
  const exactSites = new Set(eligible.map(({id,properties:p})=>p.groyne_site_id??id));
  assert.equal(found.filter(f=>f.properties.temporal_state==='present').length,exactSites.size);
  assert.equal(new Set(found.map(({id,properties:p})=>p.groyne_site_id??id)).size,found.length);
  assert(found.every(f=>String(f.properties.temporal_date).startsWith(year+'-')));
  assert.equal(render(null).layers.groynes.features.length,0);
  assert.equal(render({...at('esri:'+release,date),source:'sentinel'}).layers.groynes.features.length,0);
}
console.log('Los '+groynes.features.length+' ejes fechados quedan en sus respectivos años y muestran una sola línea por sitio.');
