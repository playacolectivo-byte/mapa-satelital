import type {
  EvidenceData,
  EvidenceFeature,
  EvidenceKind,
  EvidenceLayers,
} from './map-evidence';

export type CaptureFrame = {
  key: string;
  source: 'esri' | 'sentinel' | 'study' | 'archive';
  date: string | null;
  center: [number, number] | null;
};
export type ObservedState = 'present' | 'deflated' | 'absent' | 'not_resolved';
export type TemporalRecord = {
  id: string;
  kind: EvidenceKind;
  site: string;
  notBefore?: string;
  observations: {
    date: string;
    state: ObservedState;
    source: string;
    note: string;
  }[];
  frames?: Record<
    string,
    { state: ObservedState; date: string; note: string; source: string }
  >;
};
export type TemporalRegistry = {
  version: 1;
  sites: Record<
    string,
    { center: [number, number]; captureDates: Record<string, string> }
  >;
  records: TemporalRecord[];
};
export type TemporalState = ObservedState | 'unknown' | 'reference';
export type TemporalResolution = {
  state: TemporalState;
  date: string | null;
  note: string;
  source?: string;
};
export function resolveTemporalRecord(
  record: TemporalRecord | undefined,
  frame: CaptureFrame | null,
  registry: TemporalRegistry | null,
): TemporalResolution {
  const unknown: TemporalResolution = {
    state: 'unknown',
    date: null,
    note: 'Sin cotejo para esta captura. No equivale a ausencia.',
  };
  if (!record || !frame || !registry) return unknown;
  const reviewed = record.frames?.[frame.key];
  if (reviewed) return reviewed;
  const site = registry.sites[record.site];
  const siteDate = site?.captureDates[frame.key];
  // A mosaic date at another locality is never transferred to this object.
  const nearby =
    site &&
    frame.center &&
    Math.hypot(
      site.center[0] - frame.center[0],
      site.center[1] - frame.center[1],
    ) < 0.001;
  const date = siteDate ?? (nearby ? frame.date : null);
  if (!date) return unknown;
  if (record.notBefore && date < record.notBefore)
    return {
      state: 'absent',
      date,
      note: 'Captura anterior al inicio de construcción documentado de esta obra.',
    };
  const observation = record.observations.find((o) => o.date === date);
  if (observation) return observation;
  return { ...unknown, date };
}
export function temporalEvidence(
  layers: EvidenceLayers,
  frame: CaptureFrame | null,
  registry: TemporalRegistry | null,
  references: boolean,
) {
  const records = new Map(
    registry?.records.map((record) => [record.id, record]) ?? [],
  );
  const result: EvidenceLayers = {
    barriers: null,
    geotubes: null,
    vegetation: null,
  };
  const counts = { visible: 0, unknown: 0, absent: 0, unresolved: 0 };
  const byKind = {} as Record<
    EvidenceKind,
    { visible: number; unknown: number; absent: number }
  >;
  for (const kind of ['barriers', 'geotubes', 'vegetation'] as EvidenceKind[]) {
    const features: EvidenceFeature[] = [];
    byKind[kind] = { visible: 0, unknown: 0, absent: 0 };
    for (const feature of layers[kind]?.features ?? []) {
      const resolution = resolveTemporalRecord(
        records.get(String(feature.id ?? feature.properties.record_id)),
        frame,
        registry,
      );
      const drawable =
        resolution.state === 'present' || resolution.state === 'deflated';
      if (
        resolution.state === 'unknown' ||
        resolution.state === 'not_resolved'
      ) {
        counts.unknown++;
        byKind[kind].unknown++;
      }
      if (resolution.state === 'not_resolved') counts.unresolved++;
      if (resolution.state === 'absent') {
        counts.absent++;
        byKind[kind].absent++;
      }
      // Display authorization includes undated references, never an object
      // documented as absent at the selected capture.
      if (drawable || (references && resolution.state !== 'absent')) {
        counts.visible++;
        byKind[kind].visible++;
        features.push({
          ...feature,
          properties: {
            ...feature.properties,
            temporal_state: drawable ? resolution.state : 'reference',
            temporal_date: resolution.date,
            temporal_note: resolution.note,
            temporal_source: resolution.source ?? null,
          },
        });
      }
    }
    if (layers[kind])
      result[kind] = { type: 'FeatureCollection', features } as EvidenceData;
  }
  return { layers: result, counts, byKind };
}
export function studyMatchesCapture(
  period: string,
  frame: CaptureFrame | null,
) {
  if (!frame?.date) return false;
  const years = period.match(/\d{4}/g)?.map(Number);
  const year = Number(frame.date.slice(0, 4));
  return !!years && year >= years[0] && year <= years[years.length - 1];
}

// A resolver belongs to one immutable intake/registry/reference setting. It
// reuses unchanged layer objects so a new annual mangrove map does not rebuild
// the undated structure inventory. Cached dates retain exact location context.
export function createTemporalEvidenceResolver(
  layers: EvidenceLayers,
  registry: TemporalRegistry | null,
  references: boolean,
) {
  const cache = new Map<string, ReturnType<typeof temporalEvidence>>();
  let previous: ReturnType<typeof temporalEvidence> | null = null;
  return (frame: CaptureFrame | null) => {
    const key = JSON.stringify([frame?.key, frame?.date, frame?.center]);
    const cached = cache.get(key);
    if (cached) return cached;
    const next = temporalEvidence(layers, frame, registry, references);
    for (const kind of [
      'barriers',
      'geotubes',
      'vegetation',
    ] as EvidenceKind[]) {
      const old = previous?.layers[kind],
        current = next.layers[kind];
      if (
        old &&
        current &&
        old.features.length === current.features.length &&
        current.features.every((feature, index) => {
          const before = old.features[index];
          return (
            feature.id === before.id &&
            feature.geometry === before.geometry &&
            [
              'temporal_state',
              'temporal_date',
              'temporal_note',
              'temporal_source',
            ].every(
              (field) => feature.properties[field] === before.properties[field],
            )
          );
        })
      )
        next.layers[kind] = old;
    }
    previous = next;
    cache.set(key, next);
    if (cache.size > 32) cache.delete(cache.keys().next().value!);
    return next;
  };
}
