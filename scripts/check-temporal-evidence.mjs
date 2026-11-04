import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { temporalEvidence, resolveTemporalRecord, studyMatchesCapture } from '../lib/temporal-evidence.ts';

const json = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const registry = json('public/data/problems/temporal-observations.json');
const original = json('public/data/problems/geotube-historical-axes.geojson');
const originalText = JSON.stringify(original);
const layers = { barriers: null, geotubes: original, vegetation: null };
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
