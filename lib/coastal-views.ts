import type { Bounds } from './view';

// Camera windows only; these are not scientific cell or property boundaries.
// Original INEGI coordinates and all source localities remain unchanged.
export const coastalViews: { id: string; name: string; bounds: Bounds }[] = [
  {
    id: 'S02-310590003',
    name: 'Chelem',
    bounds: [-89.775, 21.264, -89.695, 21.295],
  },
  {
    id: 'S02-310590001',
    name: 'Progreso',
    bounds: [-89.685, 21.275, -89.539, 21.323],
  },
];
export const CHELEM_PROGRESO_OVERVIEW: Bounds = [
  -89.79, 21.25, -89.535, 21.335,
];
