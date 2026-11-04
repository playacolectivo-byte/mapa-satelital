import type { Bounds } from './view';
export type StudyFlight = {
  id: string;
  date: string;
  image: string;
  bounds: Bounds;
  title: string;
  attribution: string;
  sourceUrl: string;
  resolution: string;
  note: string;
};
export function flightNear(
  flight: StudyFlight,
  center: [number, number] | null,
) {
  if (!center) return false;
  const [w, s, e, n] = flight.bounds;
  return (
    center[0] > w - 0.008 &&
    center[0] < e + 0.008 &&
    center[1] > s - 0.008 &&
    center[1] < n + 0.008
  );
}
