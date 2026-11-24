import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createCoastalImageAlignment } from '../lib/coastal-image-alignment.ts';
import { sampleObservedCoast } from '../lib/coastal-100m-grid.ts';

const root = new URL('../', import.meta.url);
const load = path => JSON.parse(readFileSync(new URL(path, root)));
const alignmentDir = 'public/data/shorelines/photo-alignment/';
const scope = 'public/data/municipalities/progreso/';
const catalogue = load('lib/generated/municipal-photo-reviewed-catalogue.json');
const municipality = catalogue.anchors.find(anchor => anchor.municipality === 'Progreso' && anchor.review_scope === 'municipality');
assert(municipality);
const grid = load(alignmentDir + 'coastal-100m-grid-20261106.json').segments.filter(segment => segment.municipality === 'Progreso');
const stations = grid.flatMap(segment => segment.stations);
const alignment = createCoastalImageAlignment(load(scope + 'scenario.json'), load(scope + 'photos.json'), load(alignmentDir + 'revised-source-review.json'));
const direct = load(alignmentDir + 'progreso-estaciones-directas-20261116.json').features;

const longitudeStep = .02;
const firstSector = Math.floor(stations[0].coordinate[0] / longitudeStep);
const sectorCount = Math.floor(stations.at(-1).coordinate[0] / longitudeStep) - firstSector + 1;
const datesByYear = Object.groupBy(municipality.dated_captures, capture => capture.year);
for (const feature of direct) {
 const props = feature.properties;
 const after = props.photo_sources.at(-1);
 const station = stations.find(station => station.id === feature.id);
 assert(station && after.date === props.date_after);
 const rows = datesByYear[props.year] ??= [];
 for (const release of props.photo_verified_endpoint_releases) {
  if (rows.some(row => row.date === after.date && row.releases.includes(release))) continue;
  rows.push({municipality:'Progreso',year:props.year,date:after.date,coordinates:station.coordinate,profile_id:station.id,releases:[release],
   metadata:{date:Date.parse(after.date+'T00:00:00Z'),provider:after.provider,source:after.source,resolution:after.resolution_m,accuracy:after.accuracy_m}});
 }
}
const years = {};
for (const [key, captures] of Object.entries(datesByYear)) {
 const year = Number(key);
 const frames = {};
 for (const release of new Set(captures.flatMap(capture => capture.releases))) {
  const exact = new Set(direct.filter(feature => feature.properties.year === year &&
   feature.properties.photo_verified_endpoint_releases.includes(release)).map(feature => feature.id));
  const sampled = sampleObservedCoast(alignment.read(year, release, 17).layer, grid, year, 2011);
  const coverage = Array(sectorCount).fill(0);
  sampled.features.forEach((feature, index) => {
   if (!feature.properties.sampling_gap || exact.has(feature.id)) {
    coverage[Math.floor(stations[index].coordinate[0] / longitudeStep) - firstSector]++;
   }
  });
  frames[release] = coverage;
 }
 const additionalCaptures = captures.filter(capture => !municipality.dated_captures.includes(capture));
 years[year] = {frames, ...(additionalCaptures.length ? {additionalCaptures} : {})};
}
writeFileSync(new URL('lib/generated/progreso-edition-coverage.json', root), JSON.stringify({longitudeStep, firstSector, years}) + '\n');
