import type { Map as LeafletMap } from 'leaflet';

export function guardMapDragRelease(map: LeafletMap): () => void {
  const surface = map.getContainer();
  const document = surface.ownerDocument;
  const window = document.defaultView;
  if (!window) return () => {};

  const listeners = new AbortController();
  let pressed = false;
  let releaseTimer: number | undefined;

  const clearPress = () => {
    pressed = false;
    window.clearTimeout(releaseTimer);
    releaseTimer = undefined;
  };

  const releaseDrag = () => {
    if (!pressed) return;
    clearPress();
    if (!map.dragging.enabled()) return;
    map.dragging.disable();
    map.dragging.enable();
  };

  const startPress = (event: MouseEvent) => {
    if (event.button !== 0 || event.shiftKey || !map.dragging.enabled()) return;
    releaseDrag();
    pressed = true;
  };

  const scheduleRelease = (event: MouseEvent) => {
    if (event.button === 0 && pressed && releaseTimer === undefined) {
      // Give Leaflet's document mouseup listener the regular event first.
      releaseTimer = window.setTimeout(releaseDrag, 0);
    }
  };

  const capture = { capture: true, signal: listeners.signal };
  surface.addEventListener('mousedown', startPress, capture);
  window.addEventListener('mouseup', scheduleRelease, capture);
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) clearPress();
  }, { signal: listeners.signal });
  window.addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'touch') scheduleRelease(event);
  }, capture);
  window.addEventListener('pointercancel', (event) => {
    if (event.pointerType !== 'touch') releaseDrag();
  }, capture);
  window.addEventListener('mousemove', (event) => {
    if ((event.buttons & 1) === 0) releaseDrag();
  }, capture);
  window.addEventListener('blur', releaseDrag, { signal: listeners.signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseDrag();
  }, { signal: listeners.signal });

  return () => {
    listeners.abort();
    clearPress();
  };
}
