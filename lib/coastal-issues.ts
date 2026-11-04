import type { FeatureCollection, Point } from 'geojson';

export const issueTypes = [
  {
    id: 'geotubes',
    title: 'Geotubos · 2017',
    count: 6,
    note: '6 ejes históricos interpretados; no son huellas físicas',
    color: '#ff5a00',
  },
  {
    id: 'barriers',
    title: 'Muelles y escolleras',
    count: 191,
    note: '191 trazos OSM; inventario de 359 puntos conservado por separado',
    color: '#d3a8e8',
  },
  {
    id: 'dunes',
    title: 'Alteración de dunas',
    count: 0,
    note: 'Sin ubicaciones verificadas incorporadas',
    color: '#edc76d',
  },
  {
    id: 'vegetation',
    title: 'Manglar perturbado · 2020',
    count: 40,
    note: '40 polígonos CONABIO; causas naturales o humanas no diferenciadas',
    color: '#9bc4a0',
  },
] as const;
export type IssueType = (typeof issueTypes)[number]['id'];
export type IssueVisibility = Record<IssueType, boolean>;
export const initialIssues: IssueVisibility = {
  geotubes: true,
  barriers: true,
  dunes: false,
  vegetation: false,
};
// The old approximate sector pin is intentionally empty. Actual source lines
// now live in map-evidence; a sector pin must not substitute for geometry.
export const coastalCases: FeatureCollection<
  Point,
  { id: string; category: IssueType; label: string; scope: string }
> = {
  type: 'FeatureCollection',
  features: [],
};
