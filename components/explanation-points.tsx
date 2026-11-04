import type { ExplanationPoints as Points } from '@/lib/map-explanations';

/** Every explanation has one to three short, visible points. */
export function ExplanationPoints({ points }: { points: Points }) {
  return <ul className="explanation-points">
    {points.map((point) => <li key={point.label}>
      <strong>{point.label}</strong>{' '}{point.text}
    </li>)}
  </ul>;
}
