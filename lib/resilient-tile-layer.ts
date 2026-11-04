import type * as Leaflet from 'leaflet';
import { TileRecovery } from './tile-recovery';

/** Preserve Leaflet URL/CORS/retina behavior; delay tileerror until two retries
 * of the same URL have failed. Unloaded tiles never restart in the background. */
export function resilientTileLayer(layer: Leaflet.TileLayer): Leaflet.TileLayer {
  // Leaflet documents the createTile override; its typings mark it protected.
  const factory = layer as unknown as {createTile:(coords:Leaflet.Coords,done?:Leaflet.DoneCallback)=>HTMLElement};
  const original = factory.createTile.bind(layer);
  let recovery = new TileRecovery();
  const cancelled = new WeakSet<object>();
  factory.createTile = (coords, done) => original(coords, (error, element) => {
    if (!element || cancelled.has(element)) return;
    const tile = element as HTMLImageElement;
    if (error && recovery.failed(tile, () => {
      if (!cancelled.has(tile)) tile.src = tile.src;
    })) return;
    recovery.cancel(tile);
    done?.(error, tile);
  });
  layer.on('add', () => { recovery = new TileRecovery(); });
  layer.on('tileunload', (event: Leaflet.TileEvent) => {
    cancelled.add(event.tile); recovery.cancel(event.tile);
  });
  layer.on('remove', () => recovery.dispose());
  return layer;
}
