'use client';

import { useEffect, useRef, useState } from 'react';
import type { WaybackItem } from '@esri/wayback-core';
import {fetchEsriNativeZoom} from './esri-catalogue';

export type SatelliteDetail = { nativeZoom: number | null; status: 'checking' | 'ready' | 'error' };
const cache = new Map<string, number>();
const tile = ([lon, lat]: [number, number], z: number) => ({
  x: Math.floor((lon + 180) / 360 * 2 ** z),
  y: Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z),
});

// Wayback's tilemap reports availability for this edition and location. A missing
// tile is not permission to replace it with a newer image. Probe metadata only.
export function useSatelliteDetail(item: WaybackItem | null, center: [number, number] | null) {
  const [detail, setDetail] = useState<SatelliteDetail>({ nativeZoom: null, status: 'checking' });
  const lastResolved = useRef<{ release: number; nativeZoom: number } | null>(null);
  const keyTile = center && tile(center, 20);
  const key = item && keyTile ? `${item.releaseNum}/${keyTile.x}/${keyTile.y}` : '';
  useEffect(() => {
    if (!item || !center) return;
    const cached = cache.get(key);
    if (cached !== undefined) { lastResolved.current = { release: item.releaseNum, nativeZoom: cached }; setDetail({ nativeZoom: cached, status: 'ready' }); return; }
    const controller = new AbortController(); let stopped = false;
    // Keep the current edition's tiles while checking the new center. Resetting
    // to the default on every pan used to remove and recreate the image layer.
    const retainedZoom = lastResolved.current?.release === item.releaseNum ? lastResolved.current.nativeZoom : null;
    setDetail({ nativeZoom: retainedZoom, status: 'checking' });
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    const timer = window.setTimeout(async () => {
      try {
        const z=await fetchEsriNativeZoom(item,center[0],center[1],controller.signal);
        if(stopped)return;
        if(cache.size>=128)cache.delete(cache.keys().next().value!);
        cache.set(key,z);lastResolved.current={release:item.releaseNum,nativeZoom:z};setDetail({nativeZoom:z,status:'ready'});
      } catch { if (!stopped) setDetail({ nativeZoom: retainedZoom, status: 'error' }); }
      finally { window.clearTimeout(timeout); }
    }, 200);
    return () => { stopped = true; controller.abort(); window.clearTimeout(timer); window.clearTimeout(timeout); };
    // key identifies the edition and center tile. Zooming in place reuses the result.
  }, [key]);
  return detail;
}

export function satellitePixelRatio() { return typeof window !== 'undefined' && window.devicePixelRatio > 1 ? 2 : 1; }
export function satelliteTileZoom(viewZoom: number, nativeZoom: number | null) {
  return Math.max(10, Math.min(nativeZoom ?? 18, Math.round(viewZoom) + (satellitePixelRatio() === 2 ? 1 : 0)));
}
