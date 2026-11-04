'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { closestImagery, imagery, imageryService, type ImageryPlace } from '@/lib/imagery';
import { imageryTiles, type Bounds, type Point } from '@/lib/view';

export const SatelliteMedia = memo(function SatelliteMedia({
  place = 'chelem', coordinates, bounds, title, compact = false,
}: { place?: ImageryPlace; coordinates?: Point; bounds?: Bounds; title?: string; compact?: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const center = coordinates ?? imagery[place].coordinates;
  const nearest = coordinates ? closestImagery(coordinates) : imagery[place];
  const name = title ?? nearest.name;
  const tiles = imageryTiles(center, size.width, size.height, bounds);
  const tileKey = (t: (typeof tiles)[number]) => t.zoom + '/' + t.y + '/' + t.x;
  const ready = tiles.length > 0 && tiles.every(t => loaded.has(tileKey(t)));
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.ceil(width), height: Math.ceil(height) });
    });
    resize.observe(node);
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '120px' });
    observer.observe(node);
    return () => { resize.disconnect(); observer.disconnect(); };
  }, []);
  useEffect(() => {
    if (!visible || ready || failed) return;
    const timeout = window.setTimeout(() => setFailed(true), 15000);
    return () => window.clearTimeout(timeout);
  }, [visible, ready, failed, attempt]);
  return <figure aria-label={'Vista satelital de ' + name + '. Mosaico de distintas fechas.'} className={'satellite-media' + (compact ? ' is-compact' : '')}>
    <div ref={frame} className="satellite-window">
      {visible && !failed && <div className={'satellite-grid' + (ready ? ' is-ready' : '')} key={attempt}>
        {tiles.map(t => <img // oxlint-disable-line next/no-img-element -- unmodified provider tiles, laid out at native 256px
          // Provider-served geographic tiles remain unmodified and keep their native grid.
          key={tileKey(t)} alt="" aria-hidden="true" width={256} height={256} decoding="async"
          src={imageryService + '/tile/' + tileKey(t)}
          style={{ left: t.left, top: t.top }}
          onLoad={() => setLoaded(current => new Set(current).add(tileKey(t)))}
          onError={() => setFailed(true)}
        />)}
      </div>}
      {(!ready || failed) && <output className="media-state">
        <span>{failed ? 'Imagen no disponible' : 'Cargando vista satelital'}</span>
        {failed && <Button variant="ghost" onClick={() => { setLoaded(new Set()); setFailed(false); setAttempt(n => n + 1); }}><RotateCcw /> Reintentar</Button>}
      </output>}
    </div>
    <figcaption>
      <span>{name} <span className="caption-divider">/</span> Vista satelital</span>
      <details className="image-provenance"><summary>Fecha y procedencia</summary>
        <p>Referencia verificada en {nearest.name}: {nearest.capture}. La fecha puede variar dentro de esta vista; no es una imagen en vivo.</p>
        <p>{nearest.source} · {nearest.sensor} · {nearest.resolution} en el punto de referencia.</p>
      </details>
      <a href={imageryService + '?f=pjson'} target="_blank" rel="noreferrer">© Esri · Vantor · Earthstar <ArrowUpRight /></a>
    </figcaption>
  </figure>;
});
