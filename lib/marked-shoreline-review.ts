import type { CoastalAnalysisData } from './coastal-analysis.ts';
import { coastalLocalDistance, coastalLocalVector } from './coastal-100m-grid.ts';
import { coastalGridSpacingLinks } from './coastal-spacing.ts';
import referenceReview from './generated/progreso-reference-2011-review.json' with { type: 'json' };
import comparisonReview from './generated/progreso-orilla-2025-20261121.json' with { type: 'json' };
import februaryMarks from './generated/progreso-puntas-marcadas-20261123.json' with { type: 'json' };
import marchMarks from './generated/progreso-puntas-marcadas-marzo-20261123.json' with { type: 'json' };
import stationMarks from './generated/progreso-revision-estaciones-20261124.json' with { type: 'json' };

type Coordinate = [number, number];
type Feature = CoastalAnalysisData['features'][number];
type MeasuredFeature = Feature & { geometry: GeoJSON.LineString };
type ReviewedComparison = {
  profile: string;
  shoreline?: Coordinate;
  seaward?: Coordinate;
  reference?: Coordinate;
  displayLatitude?: number;
  detailZoom?: number;
};
type ReviewedReference = {
  station: string;
  profile: string | null;
  original: Coordinate | null;
  corrected: Coordinate | null;
  axis: Coordinate;
  note: string;
};
type Spacing = { reference: number; observed?: number };
type PhotoProbe = { release: number; coordinate: Coordinate; date?: string };

const referenceDate = '2011-08-01';
const referenceEdition = 11019;
const comparisonEdition = 22252;
const comparisonDate = '2025-02-13';
const method = 'progreso-orilla-2011-20261119';
const methodUrl = '/data/shorelines/photo-alignment/' + method + '.md';
const references = new Map((referenceReview as ReviewedReference[]).map(item => [item.station, item]));
type MarkedComparison = {
  profile: string;
  tip: Coordinate;
  referenceLatitude2011: number;
  supplemental?: boolean;
  direct?: boolean;
  registrationProxyM?: number;
  releases?: number[];
  station?: string;
};
type PendingMark = { profile: string; tip: Coordinate; reason: string; releases?: number[] };
type MarkedPhoto = { date: string; sensor: string; marks: Map<string, MarkedComparison>; pending: PendingMark[] };
const asProfileMap = (marks: MarkedComparison[]) => new Map(marks.map(mark => [mark.profile, mark]));
const mixedMosaicEdition = 26334;
const septemberDate = '2023-09-21';
const februaryComparisons = [...februaryMarks, ...stationMarks.february.comparisons] as MarkedComparison[];
const septemberMarks = stationMarks.september.comparisons as MarkedComparison[];
const aprilMarks = stationMarks.april.comparisons as MarkedComparison[];

export function inProgresoMarkedSeptemberSector(longitude: number | undefined): boolean {
  return longitude !== undefined && septemberMarks.some(mark =>
    Math.abs(longitude - mark.tip[0]) <= .003);
}

const markedPhotoSources = [
  { release: comparisonEdition, date: comparisonDate, sensor: 'WV03', marks: februaryComparisons,
    pending: stationMarks.february.pending as PendingMark[] },
  { release: mixedMosaicEdition, date: '2025-03-23', sensor: 'WV03', marks: marchMarks.comparisons as MarkedComparison[],
    pending: marchMarks.pending as PendingMark[] },
  { release: mixedMosaicEdition, date: stationMarks.april.date, sensor: 'LG02', marks: aprilMarks, pending: [] },
  { release: mixedMosaicEdition, date: septemberDate, sensor: 'WV02', marks: septemberMarks, pending: [] },
];
const recentMarkedPhotos = new Map([comparisonEdition, mixedMosaicEdition].map(release => [
  release,
  markedPhotoSources.map(({ release: defaultRelease, date, sensor, marks, pending }): MarkedPhoto => ({
    date, sensor, marks: asProfileMap(marks.filter(mark => (mark.releases ?? [defaultRelease]).includes(release))),
    pending: pending.filter(mark => (mark.releases ?? [defaultRelease]).includes(release)),
  })),
]));
const februaryReferenceMarks = asProfileMap([
  ...septemberMarks, ...aprilMarks, ...marchMarks.comparisons, ...februaryComparisons,
] as MarkedComparison[]);
const marchReferenceMarks = asProfileMap([
  ...septemberMarks, ...aprilMarks, ...februaryComparisons, ...marchMarks.comparisons,
] as MarkedComparison[]);

// Keep photographic endpoints and vertical display tips separate.
const checked2025 = new Map<string, ReviewedComparison>([
  ["GRID100-progreso-001-0000", {"profile": "SC-258-0-30", "shoreline": [-89.86441506640512, 21.242028437907493], "seaward": [-0.2000267, 0.97979045]}],
  ["GRID100-progreso-001-0001", {"profile": "SC-258-0-31", "shoreline": [-89.86347728044413, 21.242244435601133], "seaward": [-0.28103257, 0.95969823]}],
  ["GRID100-progreso-001-0002", {"profile": "SC-258-0-32", "shoreline": [-89.86257398174384, 21.24254843181892], "seaward": [-0.26461218, 0.96435491]}],
  ["GRID100-progreso-001-0003", {"profile": "SC-258-0-33", "shoreline": [-89.86163982646839, 21.242744429047946], "seaward": [-0.21714198, 0.97614003]}],
  ["GRID100-progreso-001-0004", {"profile": "SC-258-0-34", "shoreline": [-89.86071366699318, 21.242978425398423], "seaward": [-0.19533622, 0.98073634]}],
  ["GRID100-progreso-001-0005", {"profile": "SC-258-0-35", "shoreline": [-89.85977347133627, 21.24315042247899], "seaward": [-0.19377232, 0.98104653]}],
  ["GRID100-progreso-001-0006", {"profile": "SC-258-0-36", "shoreline": [-89.85884135263916, 21.243336419096025], "seaward": [-0.20146078, 0.97949658]}],
  ...(comparisonReview as (ReviewedComparison & { station: string })[]).map(
    (reading): [string, ReviewedComparison] => [reading.station, reading],
  ),
]);

const checked2025Uncertainty = Math.hypot(10.2, 3, 8, 5, 3, 8);

function measured(feature: Feature | undefined): feature is MeasuredFeature {
  return feature?.geometry.type === 'LineString' && feature.geometry.coordinates.length === 2 &&
    feature.properties.baseline_fixed === true && feature.properties.photo_interpretation === true &&
    feature.properties.date_before === referenceDate;
}

function updateReference(feature: Feature, release: number): Feature {
  const p = feature.properties;
  if (p.municipality !== 'Progreso') return feature;
  const station = String(p.sampling_station_id), review = references.get(station);
  if (!review) return feature;

  // A different photograph can surface a nearby profile at the same station.
  // It must never inherit a correction established on another axis.
  const [prior, previousEnd] = measured(feature)
    ? feature.geometry.coordinates as [Coordinate, Coordinate] : [];
  const sameOrigin = prior && review.original && p.profile_id === review.profile &&
    coastalLocalDistance(prior, review.original) < .05;
  const missingInReference = !review.original && p.sampling_gap === true &&
    p.year === 2011 && release === referenceEdition;
  if (!sameOrigin && !missingInReference) return feature;

  if (!review.corrected) {
    const coordinates = Array.isArray(p.sampling_coordinate) ? p.sampling_coordinate : prior;
    if (!coordinates) return feature;
    return {
      ...feature,
      geometry: { type: 'Point', coordinates },
      properties: {
        ...p, sampling_gap: true, baseline_fixed: false, photo_interpretation: false,
        delta_m: null, sampling_study_reason: review.note, sampling_alternative_release: undefined,
        progreso_reference_method_url: methodUrl,
      },
    };
  }
  if (!prior || !previousEnd) return feature;

  const baseline = review.corrected;
  const referenceOnly = p.reference_only === true && p.date_after === referenceDate;
  const checked = checked2025.get(station);
  const reviewed2025 = release === comparisonEdition && p.date_after === comparisonDate &&
    checked && p.profile_id === checked.profile &&
    (!checked.reference || coastalLocalDistance(baseline, checked.reference) < .05)
      ? checked : undefined;
  const revisedEnd = reviewed2025?.shoreline;
  const end = referenceOnly ? baseline : (revisedEnd ?? previousEnd);
  const nextVector = coastalLocalVector(baseline, end);

  // Use the seaward axis for sign even when the previous difference was zero.
  const axis = reviewed2025?.seaward ?? review.axis;
  const projection = nextVector[0] * axis[0] + nextVector[1] * axis[1];
  const metres = coastalLocalDistance(baseline, end);
  const delta = referenceOnly ? 0 : (projection ? Math.sign(projection) : 0) * metres;
  const uncertainty = revisedEnd ? checked2025Uncertainty : Number(p.registration_proxy_m);
  const probes: PhotoProbe[] = (Array.isArray(p.photo_metadata_points) ? p.photo_metadata_points as PhotoProbe[] : [])
    .filter(probe => probe.date !== referenceDate && probe.release !== referenceEdition &&
      (!revisedEnd || probe.release !== comparisonEdition));
  if (revisedEnd) probes.push({ release: comparisonEdition, date: comparisonDate, coordinate: end });
  return {
    ...feature,
    geometry: { type: 'LineString', coordinates: [baseline, end] },
    properties: {
      ...p,
      baseline_coordinate: baseline,
      ...(referenceOnly || revisedEnd ? { image_anchor_coordinate: end, photo_anchor_coordinate: end } : {}),
      ...(reviewed2025?.displayLatitude !== undefined ? { display_shoreline_latitude: reviewed2025.displayLatitude } : {}),
      ...(reviewed2025?.detailZoom ? { photo_detail_review_pending: false, photo_review_tile_zoom: reviewed2025.detailZoom } : {}),
      sampling_profile_distance_m: Array.isArray(p.sampling_coordinate)
        ? coastalLocalDistance(p.sampling_coordinate as Coordinate, baseline) : p.sampling_profile_distance_m,
      delta_m: delta,
      direction_unresolved: !referenceOnly && (!Number.isFinite(uncertainty) || uncertainty <= 0 || Math.abs(delta) <= uncertainty),
      ...(revisedEnd ? { registration_proxy_m: uncertainty } : {}),
      photo_metadata_points: [{ release: referenceEdition, date: referenceDate, coordinate: baseline }, ...probes],
      user_reference_method: method,
      reference_method_url: methodUrl,
      progreso_reference_method_url: methodUrl,
    },
  };
}

export function applyMarkedShorelineReview(
  layer: CoastalAnalysisData, release: number | null, source: CoastalAnalysisData, preferredRecentEdition?: number,
  year = release === referenceEdition ? 2011 : 2025,
): CoastalAnalysisData {
  if (release === null) return layer;
  const reviewed = layer.features.map(feature => updateReference(feature, release));
  const features = applyMarkedComparisons(reviewed, source, release, year, preferredRecentEdition);
  if (features.length === layer.features.length && features.every((feature, i) => feature === layer.features[i])) return layer;

  const byStation = new Map(features.map(f => [String(f.properties.sampling_station_id), f]));
  const spacing = new Map<string, { previous?: Spacing; next?: Spacing }>();
  for (const link of coastalGridSpacingLinks({ ...layer, features })) {
    const a = byStation.get(link.from.id), b = byStation.get(link.to.id);
    if (link.pending || !measured(a) || !measured(b)) continue;
    const adjustLeft = a.properties.progreso_reference_method_url === methodUrl || a.properties.marked_shoreline_comparison === true;
    const adjustRight = b.properties.progreso_reference_method_url === methodUrl || b.properties.marked_shoreline_comparison === true;
    if (!adjustLeft && !adjustRight) continue;
    const [leftBefore, leftAfter] = a.geometry.coordinates as [Coordinate, Coordinate];
    const [rightBefore, rightAfter] = b.geometry.coordinates as [Coordinate, Coordinate];
    const distance: Spacing = { reference: coastalLocalDistance(leftBefore, rightBefore) };
    if (a.properties.date_after === b.properties.date_after && a.properties.date_after !== referenceDate) {
      distance.observed = coastalLocalDistance(leftAfter, rightAfter);
    }
    spacing.set(link.from.id, { ...spacing.get(link.from.id), next: distance });
    spacing.set(link.to.id, { ...spacing.get(link.to.id), previous: distance });
  }
  return {
    ...layer,
    features: features.map(feature => {
      const distances = spacing.get(String(feature.properties.sampling_station_id));
      return distances ? { ...feature, properties: { ...feature.properties, marked_neighbor_spacing: distances } } : feature;
    }),
  };
}

/** Recompare the reviewed positions along the same meridian in both photos. */
function applyMarkedComparisons(
  features: Feature[], source: CoastalAnalysisData, release: number, year: number, preferredRecentEdition?: number,
): Feature[] {
  const referenceView = year === 2011 && release === referenceEdition;
  const photos = (recentMarkedPhotos.get(release) ?? []).filter(photo => photo.date.startsWith(year + '-'));
  if (!referenceView && !photos.length) return features;
  // The same profile can have a different historical crossing in each pair.
  // In the 2011 view prefer the pair offered for 2025 in the current sector.
  const referenceMarks = preferredRecentEdition === mixedMosaicEdition ? marchReferenceMarks : februaryReferenceMarks;
  const marksByStation = new Map([...referenceMarks.values()].filter(mark => mark.station)
    .map(mark => [mark.station, mark]));
  const historicalByProfile = referenceView ? new Map(source.features.filter(feature =>
    feature.properties.reference_only === true && feature.properties.date_after === referenceDate && measured(feature))
    .map(feature => [feature.properties.profile_id, feature])) : undefined;
  // A single Wayback release can contain mosaics from several dates.
  const photosByDate = new Map(photos.map(photo => [photo.date, photo]));
  const directByStation = new Map<string, { mark: MarkedComparison; photo: MarkedPhoto }>();
  for (const photo of photos) {
    for (const mark of photo.marks.values()) {
      if (mark.direct && mark.station) directByStation.set(mark.station, { mark, photo });
    }
  }
  const markForFeature = (feature: Feature) => {
    const profile = String(feature.properties.profile_id);
    const photo = photosByDate.get(String(feature.properties.date_after));
    return { photo, mark: referenceView ? referenceMarks.get(profile) : photo?.marks.get(profile) };
  };
  const buildComparison = (mark: MarkedComparison, supplemental: boolean, photo?: MarkedPhoto, feature?: Feature): Feature => {
    const date = photo?.date ?? referenceDate;
    const station = feature?.properties;
    const p: Feature['properties'] = (mark.direct ? undefined : station) ?? {
      profile_id: mark.profile, municipality: 'Progreso', year, baseline_year: 2011,
      reference_only: referenceView, baseline_fixed: true, photo_interpretation: true,
      photo_location_matched: true, date_before: referenceDate, date_after: date, photo_date: date,
      photo_sources: [
        { date: referenceDate, provider: 'Esri Wayback', source: 'WV02' },
        ...(photo ? [{ date, provider: 'Esri Wayback', source: photo.sensor }] : []),
      ],
      direct_marked_profile: true,
      ...(station?.sampling_station === true ? {
        sampling_station: true, sampling_station_id: station.sampling_station_id,
        sampling_coordinate: station.sampling_coordinate, grid_segment: station.grid_segment,
        grid_chainage_m: station.grid_chainage_m, grid_spacing_m: station.grid_spacing_m,
      } : {}),
    };
    const baseline: Coordinate = [mark.tip[0], mark.referenceLatitude2011];
    const end = referenceView ? baseline : mark.tip;
    // The sea is north of these marked profiles of Progreso.
    const [, delta] = coastalLocalVector(baseline, end);
    const archivedProxy = p.registration_proxy_m;
    const uncertainty = typeof archivedProxy === 'number' && Number.isFinite(archivedProxy)
      ? Math.max(archivedProxy, mark.registrationProxyM ?? 0) : (mark.registrationProxyM ?? null);
    const probes: PhotoProbe[] = [{ release: referenceEdition, date: referenceDate, coordinate: baseline }];
    if (photo) probes.push({ release, date, coordinate: end });
    return {
      type: 'Feature',
      id: feature?.id ?? mark.profile,
      geometry: { type: 'LineString', coordinates: [baseline, end] },
      properties: {
        ...p,
        marked_shoreline_comparison: true,
        baseline_coordinate: baseline,
        image_anchor_coordinate: end,
        photo_anchor_coordinate: end,
        photo_metadata_points: probes,
        sampling_profile_distance_m: Array.isArray(p.sampling_coordinate)
          ? coastalLocalDistance(p.sampling_coordinate as Coordinate, baseline) : p.sampling_profile_distance_m,
        delta_m: delta,
        registration_proxy_m: uncertainty,
        direction_unresolved: !referenceView && (typeof uncertainty !== 'number' ||
          !Number.isFinite(uncertainty) || uncertainty <= 0 || Math.abs(delta) <= uncertainty),
        ...(supplemental ? { spacing_eligible: false, supplemental_profile: true } : {}),
      },
    };
  };
  const withMarkedComparison = (feature: Feature, supplemental = false): Feature => {
    const p = feature.properties;
    const station = String(p.sampling_station_id ?? '');
    if (referenceView && p.municipality === 'Progreso' && station) {
      const stationMark = marksByStation.get(station);
      if (stationMark?.direct) return buildComparison(stationMark, false, undefined, feature);
      const historical = stationMark && historicalByProfile?.get(stationMark.profile);
      if (stationMark && historical) {
        return buildComparison(stationMark, false, undefined, {
          ...historical,
          properties: { ...p, ...historical.properties, sampling_gap: false, photo_review_pending: false },
        });
      }
    }
    const direct = directByStation.get(station);
    if (direct && p.municipality === 'Progreso' && p.year === year &&
        (p.sampling_gap === true || p.profile_id === direct.mark.profile)) {
      return buildComparison(direct.mark, false, direct.photo, feature);
    }
    const { photo, mark } = markForFeature(feature);
    if (!mark || mark.direct || p.municipality !== 'Progreso' || !measured(feature) ||
        typeof p.delta_m !== 'number' || !Number.isFinite(p.delta_m) ||
        (referenceView && (p.reference_only !== true || p.date_after !== referenceDate))) return feature;
    return buildComparison(mark, supplemental, photo, feature);
  };
  const comparisons = features.map(feature => withMarkedComparison(feature));
  const present = new Set(comparisons.map(feature => feature.properties.profile_id));
  for (const feature of source.features) {
    const id = String(feature.properties.profile_id);
    const { mark } = markForFeature(feature);
    // The archival edition can sample a different profile at the same station.
    // Keep the exact historical point for a bar selected by the recent frame.
    if (!mark || (!mark.supplemental && !referenceView) || present.has(id)) continue;
    const marked = withMarkedComparison(feature, true);
    if (marked === feature) continue;
    comparisons.push(marked);
    present.add(id);
  }
  const datedFrames = new Set(source.features.filter(feature => feature.properties.municipality === 'Progreso' &&
    feature.properties.year === year && measured(feature)).map(feature => feature.properties.date_after));
  const directPhotos = referenceView ? [{ date: referenceDate, marks: referenceMarks, photo: undefined }] :
    photos.map(photo => ({ date: photo.date, marks: photo.marks, photo }));
  for (const { date, marks, photo } of directPhotos) {
    if (!datedFrames.has(date)) continue;
    for (const mark of marks.values()) {
      if (mark.direct && mark.supplemental && Number.isFinite(mark.registrationProxyM) && !present.has(mark.profile)) {
        comparisons.push(buildComparison(mark, true, photo));
        present.add(mark.profile);
      }
    }
    if (photo) {
      for (const mark of photo.pending) {
        // The markup locates the site. No historical crossing was established here.
        const index = comparisons.findIndex(feature => feature.properties.profile_id === mark.profile);
        const previous = comparisons[index];
        const pending: Feature = {
          type: 'Feature',
          id: previous?.id ?? mark.profile,
          geometry: { type: 'Point', coordinates: mark.tip },
          properties: {
            ...previous?.properties, profile_id: mark.profile, municipality: 'Progreso', year, photo_date: date,
            baseline_fixed: false, photo_interpretation: false, photo_review_pending: true, direction_unresolved: true,
            delta_m: null, spacing_eligible: false, marked_pending_reason: mark.reason,
          },
        };
        if (index === -1) comparisons.push(pending);
        else comparisons[index] = pending;
      }
    }
  }
  return comparisons;
}
