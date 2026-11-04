'use client';

import { memo, useMemo } from 'react';
import type { FeatureCollection } from 'geojson';
import type { MapConfig } from '@/lib/territory';
import { project, type Point } from '@/lib/view';

export const IntroTerritory = memo(function IntroTerritory({ context, config }: { context: FeatureCollection | null; config: MapConfig | null }) {
  const paths = useMemo(() => context?.features.flatMap(feature => {
    const geometry = feature.geometry;
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : geometry.type === 'Polygon' ? [geometry.coordinates] : [];
    return polygons.map(polygon => polygon.map(ring => ring.map((p, i) => {
      const [x, y] = project(p as Point);
      return (i ? 'L' : 'M') + x * 100000 + ',' + y * 100000;
    }).join(' ') + 'Z').join(' '));
  }) ?? [], [context]);
  const a = project([-90.15, 21.55]), b = project([-89.15, 20.95]);
  const chelem = config?.places.find(p => p.name === 'Chelem');
  const point = chelem ? project(chelem.coordinates) : null;
  return <div className="intro-territory" aria-hidden="true">
    <svg viewBox={[a[0] * 100000, a[1] * 100000, (b[0] - a[0]) * 100000, (b[1] - a[1]) * 100000].join(' ')} preserveAspectRatio="xMidYMid slice">
      {paths.map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}
      {point && <g><circle cx={point[0] * 100000} cy={point[1] * 100000} r="2.4" /><text x={point[0] * 100000 + 5} y={point[1] * 100000 - 5}>Chelem</text></g>}
    </svg>
    <span className="intro-map-caption">Litoral de Yucatán <span>Contexto cartográfico · INEGI</span></span>
  </div>;
});
