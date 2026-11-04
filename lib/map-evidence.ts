import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Polygon,
  MultiPolygon,
} from 'geojson';
import { GMW_SOURCE, isMangroveChange } from './mangrove-history';
import type { Bounds } from './view';

export type EvidenceKind = 'barriers' | 'geotubes' | 'vegetation';
export type EvidenceFeature = Feature<
  LineString | MultiLineString | Polygon | MultiPolygon,
  Record<string, unknown>
>;
export type EvidenceData = FeatureCollection<
  EvidenceFeature['geometry'],
  EvidenceFeature['properties']
>;
export type EvidenceLayers = Record<EvidenceKind, EvidenceData | null>;
export type EvidenceSelection = {
  kind: EvidenceKind;
  feature: EvidenceFeature;
};
export const evidenceKinds: EvidenceKind[] = [
  'barriers',
  'geotubes',
  'vegetation',
];
export const evidenceColors: Record<EvidenceKind, string> = {
  barriers: '#d3a8e8',
  geotubes: '#ff5a00',
  vegetation: '#b8d776',
};
export const evidenceViews: Record<EvidenceKind, Bounds> = {
  barriers: [-89.709, 21.277, -89.695, 21.29],
  geotubes: [-89.5564, 21.3068, -89.5541, 21.3079],
  vegetation: [-89.53, 21.276, -89.511, 21.288],
};
export function evidenceTitle({ kind, feature }: EvidenceSelection) {
  const p = feature.properties;
  if (isMangroveChange(feature))
    return (
      (p.change === 'loss' ? 'Pérdida estimada' : 'Ganancia estimada') +
      ' · ' +
      p.previous_year +
      ' → ' +
      p.year
    );
  return kind === 'barriers'
    ? typeof p.type_label === 'string'
      ? p.type_label
      : 'Estructura cartografiada'
    : kind === 'geotubes'
      ? typeof p.label === 'string'
        ? p.label
        : 'Geotubo · disposición histórica'
      : 'Manglar perturbado · 2020';
}
export function evidenceSource({ kind, feature }: EvidenceSelection) {
  if (isMangroveChange(feature)) return GMW_SOURCE;
  return kind === 'barriers'
    ? String(feature.properties.source_url)
    : kind === 'geotubes'
      ? 'https://doi.org/10.3390/w11040635'
      : 'https://idefor.cnf.gob.mx/layers/geonode:mx_mp2020gw';
}
export const evidenceNotes: Record<EvidenceKind, string> = {
  barriers:
    'Trazo de OpenStreetMap; un polígono conserva su contorno cartografiado y una línea no define anchura. Fecha de edición cartográfica, no de construcción. Existencia actual y daños sin verificar.',
  geotubes:
    'Seis ejes interpretados de la disposición de 2017 señalada por los autores en la figura 5. El 11 de abril de 2018 G2 y G3 seguían llenos; los otros cuatro estaban desinflados. Desinflado no acredita retiro de todo el material. Anchura y precisión absoluta sin determinar; estado actual sin verificar.',
  vegetation:
    'Polígonos oficiales de manglar perturbado de CONABIO, escala 1:50,000, imágenes de enero–mayo de 2020. La categoría puede incluir causas naturales y humanas; no equivale a retiro de vegetación ni demuestra responsabilidad.',
};
export function evidenceNote(selection: EvidenceSelection) {
  return isMangroveChange(selection.feature)
    ? 'Cambio entre clases anuales estimadas de Global Mangrove Watch 4.1.12, resolución nominal de 30 m. El contorno sigue los píxeles clasificados; no es un borde de vegetación levantado en campo. La fuente rellena algunas carencias de imágenes y filtra temporalmente; no identifica por píxel qué valores fueron rellenados. Una pérdida de clase no demuestra tala, árboles muertos ni una causa humana. Áreas sin ajuste local de exactitud ni intervalos de confianza.'
    : evidenceNotes[selection.kind];
}
export function isEvidenceData(value: unknown): value is EvidenceData {
  if (!value || typeof value !== 'object') return false;
  const d = value as EvidenceData;
  return (
    d.type === 'FeatureCollection' &&
    Array.isArray(d.features) &&
    d.features.every(
      (f) =>
        f.type === 'Feature' &&
        ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(
          f.geometry?.type,
        ) &&
        !!f.properties,
    )
  );
}
