import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';

export type TransectFeature = Feature<LineString, { idPol_Tran: string; [key: string]: unknown }>;
export type TransectPair<F extends TransectFeature = TransectFeature> = { id: string; a: F; b: F; group: string };
export type TransectPairIndex<F extends TransectFeature = TransectFeature> = {
  pairs: TransectPair<F>[];
  byBar: Map<string, TransectPair<F>>;
  byId: Map<string, TransectPair<F>>;
  previous: Map<string, TransectPair<F>>;
  next: Map<string, TransectPair<F>>;
};
export type TransectSpan = {
  id: string;
  aId: string;
  bId: string;
  distanceM: number;
  bars: FeatureCollection<LineString>;
  area: Feature<Polygon>;
  connector: Feature<LineString>;
  label: Feature<Point>;
};

/** Adjacent *available* axes, ordered by the author's ID, within the same original P group.
 * The index is independent of the selected date. A missing value never re-pairs a bar.
 * These P groups and spans are not newly delimited coastal cells or property boundaries. */
export function createTransectPairIndex<F extends TransectFeature>(features: F[]): TransectPairIndex<F> {
  const groups = new Map<string, { order: number; feature: F }[]>();
  const seen = new Set<string>();
  for (const feature of features) {
    const id = feature.properties.idPol_Tran;
    const match = /^P(\d+)_T(\d+)$/.exec(id);
    if (!match || seen.has(id)) throw new Error('Barra sin identificador original único: ' + id);
    seen.add(id);
    const key = 'P' + match[1];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ order: Number(match[2]), feature });
  }
  const index: TransectPairIndex<F> = { pairs: [], byBar: new Map(), byId: new Map(), previous: new Map(), next: new Map() };
  for (const [group, entries] of [...groups].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))) {
    entries.sort((a, b) => a.order - b.order);
    let previous: TransectPair<F> | null = null;
    for (let i = 0; i + 1 < entries.length; i++) {
      const a = entries[i].feature, b = entries[i + 1].feature;
      const pair = { id: a.properties.idPol_Tran + '--' + b.properties.idPol_Tran, a, b, group };
      index.pairs.push(pair);
      index.byId.set(pair.id, pair);
      index.byBar.set(a.properties.idPol_Tran, pair);
      if (i + 2 === entries.length) index.byBar.set(b.properties.idPol_Tran, pair);
      if (previous) { index.previous.set(pair.id, previous); index.next.set(previous.id, pair); }
      previous = pair;
    }
  }
  return index;
}

/** Vincenty inverse on WGS84. Short local baselines; no silent spherical fallback. */
export function wgs84DistanceM(a: number[], b: number[]): number {
  if (![...a.slice(0, 2), ...b.slice(0, 2)].every(Number.isFinite)) throw new Error('Coordenada no válida');
  if (a[0] === b[0] && a[1] === b[1]) return 0;
  const radians = Math.PI / 180, major = 6378137, flattening = 1 / 298.257223563, minor = major * (1 - flattening);
  const u1 = Math.atan((1 - flattening) * Math.tan(a[1] * radians));
  const u2 = Math.atan((1 - flattening) * Math.tan(b[1] * radians));
  const s1 = Math.sin(u1), c1 = Math.cos(u1), s2 = Math.sin(u2), c2 = Math.cos(u2);
  const longitude = (b[0] - a[0]) * radians;
  let lambda = longitude, sinSigma = 0, cosSigma = 0, sigma = 0, cosSqAlpha = 0, cos2SigmaM = 0, converged = false;
  for (let i = 0; i < 100; i++) {
    const sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda);
    sinSigma = Math.hypot(c2 * sinLambda, c1 * s2 - s1 * c2 * cosLambda);
    if (sinSigma === 0) return 0;
    cosSigma = s1 * s2 + c1 * c2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = c1 * c2 * sinLambda / sinSigma;
    cosSqAlpha = Math.max(0, 1 - sinAlpha * sinAlpha);
    cos2SigmaM = cosSqAlpha < 1e-15 ? 0 : cosSigma - 2 * s1 * s2 / cosSqAlpha;
    const c = flattening / 16 * cosSqAlpha * (4 + flattening * (4 - 3 * cosSqAlpha));
    const next = longitude + (1 - c) * flattening * sinAlpha * (sigma + c * sinSigma * (cos2SigmaM + c * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));
    if (Math.abs(next - lambda) < 1e-12) { converged = true; break; }
    lambda = next;
  }
  if (!converged) throw new Error('La distancia geodésica no convergió');
  const uSq = cosSqAlpha * (major ** 2 - minor ** 2) / minor ** 2;
  const aa = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const bb = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const delta = bb * sinSigma * (cos2SigmaM + bb / 4 * (cosSigma * (-1 + 2 * cos2SigmaM ** 2) - bb / 6 * cos2SigmaM * (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cos2SigmaM ** 2)));
  return minor * aa * (sigma - delta);
}

/** Halfway along the original axis (all received S34 axes contain two vertices).
 * Segment interpolation is only for locating the centre, not a new shoreline position. */
export function transectCentre(feature: TransectFeature): [number, number] {
  const points = feature.geometry.coordinates;
  const lengths = points.slice(1).map((point, i) => wgs84DistanceM(points[i], point));
  let remaining = lengths.reduce((sum, value) => sum + value, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const t = lengths[i] ? remaining / lengths[i] : 0;
      return [points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t];
    }
    remaining -= lengths[i];
  }
  throw new Error('Barra sin geometría de longitud válida');
}

export function transectSpan(pair: TransectPair): TransectSpan {
  const aCentre = transectCentre(pair.a), bCentre = transectCentre(pair.b);
  const a = pair.a.geometry.coordinates, originalB = pair.b.geometry.coordinates;
  // Align endpoint directions before drawing the visual span, without changing either axis.
  const direct = wgs84DistanceM(a[0], originalB[0]) + wgs84DistanceM(a.at(-1)!, originalB.at(-1)!);
  const crossed = wgs84DistanceM(a[0], originalB.at(-1)!) + wgs84DistanceM(a.at(-1)!, originalB[0]);
  const b = direct <= crossed ? originalB : [...originalB].reverse();
  return {
    id: pair.id, aId: pair.a.properties.idPol_Tran, bId: pair.b.properties.idPol_Tran,
    distanceM: wgs84DistanceM(aCentre, bCentre),
    bars: { type: 'FeatureCollection', features: [pair.a, pair.b] },
    area: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...a, ...[...b].reverse(), a[0]]] } },
    connector: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [aCentre, bCentre] } },
    label: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [(aCentre[0] + bCentre[0]) / 2, (aCentre[1] + bCentre[1]) / 2] } },
  };
}

export const spanDistanceLabel = (distanceM: number) => '≈ ' + distanceM.toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' m';

export type TransectIndex<F extends TransectFeature = TransectFeature> = {
  features: F[];
  byId: Map<string, F>;
  previous: Map<string, F>;
  next: Map<string, F>;
};
export type BarFootprint = {
  id: string;
  feature: TransectFeature;
  frontM: number | null;
  axisLengthM: number;
  partial: boolean;
  front: Feature<LineString>;
  ticks: FeatureCollection<LineString>;
  label: Feature<Point>;
  origin: [number, number];
};

export function createTransectIndex<F extends TransectFeature>(features: F[]): TransectIndex<F> {
  const pairs = createTransectPairIndex(features);
  const index: TransectIndex<F> = { features: [...features].sort((a, b) => {
    const aa = a.properties.idPol_Tran.match(/\d+/g)!.map(Number), bb = b.properties.idPol_Tran.match(/\d+/g)!.map(Number);
    return aa[0] - bb[0] || aa[1] - bb[1];
  }), byId: new Map(features.map((feature) => [feature.properties.idPol_Tran, feature])), previous: new Map(), next: new Map() };
  for (const pair of pairs.pairs) { index.next.set(pair.a.properties.idPol_Tran, pair.b); index.previous.set(pair.b.properties.idPol_Tran, pair.a); }
  return index;
}

/** Display reference around one axis, split halfway to its available neighbours.
 * This is a labelled graphic convention, never a validated area of scientific representativeness.
 * At group ends it stops at the outer axis: no fabricated continuation beyond received data. */
export function barFootprint(feature: TransectFeature, index: TransectIndex): BarFootprint {
  const id = feature.properties.idPol_Tran, centre = transectCentre(feature);
  const previous = index.previous.get(id), next = index.next.get(id);
  const midpoint = (a: number[], b: number[]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const left = previous ? midpoint(transectCentre(previous), centre) : centre;
  const right = next ? midpoint(transectCentre(next), centre) : centre;
  const points = feature.geometry.coordinates;
  const first = points[0], last = points.at(-1)!;
  const origin = (first[1] <= last[1] ? first : last).slice(0, 2) as [number, number];
  const opposite = first[1] <= last[1] ? last : first;
  // Place the bracket at the outer end for legibility. Its value still uses the
  // original centre spacing; this translation is display annotation only.
  const displayLeft = [left[0] + opposite[0] - centre[0], left[1] + opposite[1] - centre[1]];
  const displayRight = [right[0] + opposite[0] - centre[0], right[1] + opposite[1] - centre[1]];
  const tick = (point: number[]): Feature<LineString> => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [-0.07, 0.07].map((fraction) => [point[0] + fraction * (opposite[0] - origin[0]), point[1] + fraction * (opposite[1] - origin[1])]) } });
  return {
    id, feature,
    frontM: previous || next ? wgs84DistanceM(left, centre) + wgs84DistanceM(centre, right) : null,
    axisLengthM: points.slice(1).reduce((sum, point, i) => sum + wgs84DistanceM(points[i], point), 0),
    partial: !previous || !next,
    front: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [displayLeft, opposite, displayRight] } },
    ticks: { type: 'FeatureCollection', features: previous || next ? [tick(displayLeft), tick(displayRight)] : [] },
    label: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: opposite } },
    origin,
  };
}
