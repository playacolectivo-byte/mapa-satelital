import type * as Leaflet from 'leaflet';

export type RasterFrame = {
  key: string;
  url: string;
  options: Leaflet.TileLayerOptions;
  wms?: Pick<Leaflet.WMSOptions, 'layers' | 'version' | 'format'>;
};
type Entry = {
  frame: RasterFrame;
  layer: Leaflet.TileLayer;
  ready: boolean;
  failed: boolean;
  timedOut:boolean;
  used: number;
};

// Keep at most two live raster frames (current and one nearby capture). Warm
// layers remain transparent on the map, retaining decoded tiles in Leaflet.
// A fast drag only requests its settled image; dated indicators are immediate.
export class RasterFrameCache {
  private failedWarm=new Set<string>();
  private entries = new Map<string, Entry>();
  private requested: string | null = null;
  private displayed: string | null = null;
  private nearby: RasterFrame[] = [];
  private tick = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private warmTimer: ReturnType<typeof setTimeout> | undefined;
  private loadTimer: ReturnType<typeof setTimeout> | undefined;
  private signature = '';
  private requestIdentity = '';
  private map: Leaflet.Map;
  private create: (frame: RasterFrame) => Leaflet.TileLayer;
  private status: (status: 'loading' | 'ready' | 'error') => void;
  private delay: number;
  private warmDelay: number;
  private loadTimeout: number;
  private onDisplayed?: (key:string)=>void;
  private preserveReadyOnFailure:()=>boolean;
  private onMoveStart = () => {
    this.failedWarm.clear();
    clearTimeout(this.warmTimer);
    // Hidden captures must not download another viewport while the user pans.
    // Their HTTP-cached tiles remain reusable without keeping decoded DOM alive.
    for(const [key,entry] of this.entries) if(key!==this.requested && key!==this.displayed) {
      entry.layer.remove();entry.layer.off();this.entries.delete(key);
    }
  };
  private onMoveEnd = () => this.warm();
  constructor(
    map: Leaflet.Map,
    create: (frame: RasterFrame) => Leaflet.TileLayer,
    status: (status: 'loading' | 'ready' | 'error') => void,
    delay = 60,
    warmDelay = 600,
    loadTimeout = 12000,
    onDisplayed?: (key:string) => void,
    preserveReadyOnFailure:()=>boolean = ()=>false,
  ) {
    this.map = map;
    this.create = create;
    this.status = status;
    this.delay = delay;
    this.warmDelay = warmDelay;
    this.loadTimeout = loadTimeout;
    this.onDisplayed=onDisplayed;this.preserveReadyOnFailure=preserveReadyOnFailure;
    this.map.on('movestart',this.onMoveStart);
    this.map.on('moveend',this.onMoveEnd);
  }
  select(frame: RasterFrame | null, nearby: RasterFrame[] = []) {
    const signature = JSON.stringify([
      frame?.key,
      frame?.options.maxNativeZoom,
      nearby.map((item) => item.key),
    ]);
    if (
      signature === this.signature &&
      !(frame && this.entries.get(frame.key)?.failed || frame && this.entries.get(frame.key)?.timedOut)
    )
      return;
    const identity = JSON.stringify([frame?.key, frame?.options.maxNativeZoom]);
    const sameRequest = identity === this.requestIdentity && !this.entries.get(frame?.key ?? '')?.failed && !this.entries.get(frame?.key ?? '')?.timedOut;
    this.signature = signature;
    this.requestIdentity = identity;
    this.requested = frame?.key ?? null;
    this.nearby = nearby.filter((item) => item.key !== frame?.key).slice(0, 1);
    // Stop obsolete in-flight frames from competing with the new selection.
    // Fully decoded frames stay cached; only unfinished background work goes.
    for (const [key, entry] of this.entries) {
      if (key !== this.requested && key !== this.displayed && !entry.ready &&
        (!sameRequest || !this.nearby.some(item => item.key === key))) {
        entry.layer.remove();
        // Leaflet's internal one-shot 'remove' listener detaches its map
        // events. Clearing listeners first leaves a disposed layer on zoom.
        entry.layer.off();
        this.entries.delete(key);
      }
    }
    // Metadata can change the prefetch list repeatedly. It must never restart
    // the selected image's debounce, timeout or download in the process.
    if (sameRequest) {
      if (this.entries.get(frame?.key ?? '')?.ready) this.warm();
      return;
    }
    clearTimeout(this.timer);
    clearTimeout(this.warmTimer);
    clearTimeout(this.loadTimer);
    if (!frame) {
      const reference=this.entries.get(this.displayed??'');
      if(this.preserveReadyOnFailure()&&reference?.ready&&!reference.failed){
        for(const [key,entry]of this.entries)if(key!==this.displayed&&!entry.ready){entry.layer.remove();entry.layer.off();this.entries.delete(key);}
        this.status('loading');return;
      }
      // A year change briefly clears selection while exact-date metadata is
      // committed. Hide decoded frames, rather than destroying the warm cache.
      // They never stand in for the missing year. A pan removes hidden frames
      // before they can request another viewport (onMoveStart above).
      for (const [key,entry] of this.entries) {
        if (entry.ready && !entry.failed) entry.layer.setOpacity(0);
        else { entry.layer.remove(); entry.layer.off(); this.entries.delete(key); }
      }
      this.displayed = null;
      return;
    }
    const old = this.entries.get(frame.key);
    if (
      old &&
      Math.min(this.map.getZoom(), old.frame.options.maxNativeZoom ?? 18) ===
        Math.min(this.map.getZoom(), frame.options.maxNativeZoom ?? 18) &&
      old.ready &&
      !old.layer.isLoading()
    ) {
      this.activate(this.ensure(frame));
      return;
    }
    this.status('loading');
    this.timer = setTimeout(() => {
      if (this.requested !== frame.key) return;
      const entry = this.ensure(frame);
      if (entry.ready && !entry.layer.isLoading()) this.activate(entry);
      else this.watch(entry);
    }, this.delay);
  }
  private ensure(frame: RasterFrame): Entry {
    const existing = this.entries.get(frame.key);
    if (existing) {
      const previous = existing.frame.options.maxNativeZoom ?? 18;
      const next = frame.options.maxNativeZoom ?? 18;
      existing.frame = frame;
      if (frame.key === this.requested) existing.used = ++this.tick;
      existing.layer.options.maxNativeZoom = next;
      if (
        Math.min(this.map.getZoom(), previous) !==
          Math.min(this.map.getZoom(), next) ||
        existing.failed || existing.timedOut
      ) {
        existing.ready = false;
        existing.failed = false;
        existing.timedOut = false;
        existing.layer.redraw();
      }
      return existing;
    }
    const layer = this.create(frame);
    const entry: Entry = {
      frame,
      layer,
      ready: false,
      failed: false,
      timedOut:false,
      used: frame.key === this.requested ? ++this.tick : 0,
    };
    this.entries.set(frame.key, entry);
    layer.setOpacity(0).setZIndex(1);
    layer.on('loading', () => {
      entry.ready = false;
      entry.failed = false;
      entry.timedOut=false;
      if (this.requested === frame.key) this.status('loading');
      if (this.requested === frame.key) this.watch(entry);
    });
    layer.on('tileerror', () => {
      entry.failed = true;
      if(this.requested!==frame.key)this.failedWarm.add(frame.key);
      if (this.requested === frame.key) {
        clearTimeout(this.loadTimer);
        this.showFailure(entry);
        this.status('error');
      }
    });
    layer.on('load', () => {
      entry.ready = !entry.failed;
      if (this.requested === frame.key) {
        clearTimeout(this.loadTimer);
        if (entry.failed) {
          this.showFailure(entry);
          this.status('error');
        } else this.activate(entry);
      } else if (entry.ready) this.warm();
    });
    layer.addTo(this.map);
    const container = layer.getContainer();
    if (container) container.dataset.frameKey = frame.key;
    this.trim();
    return entry;
  }
  private display(entry: Entry) {
    this.displayed = entry.frame.key;
    this.onDisplayed?.(entry.frame.key);
    for (const other of this.entries.values()) {
      const selected = other === entry;
      other.layer.setOpacity(selected ? 1 : 0).setZIndex(selected ? 2 : 1);
    }
  }
  private showFailure(entry:Entry){
    const previous=this.entries.get(this.displayed??'');
    if(this.preserveReadyOnFailure()&&previous&&previous!==entry&&previous.ready&&!previous.failed){entry.layer.setOpacity(0);return;}
    this.display(entry);
  }
  private activate(entry: Entry) {
    if (this.requested !== entry.frame.key) return;
    entry.used = ++this.tick;
    entry.timedOut=false;
    this.display(entry);
    clearTimeout(this.loadTimer);
    this.status('ready');
    this.trim();
    this.warm();
  }
  private watch(entry: Entry) {
    clearTimeout(this.loadTimer);
    this.loadTimer = setTimeout(() => {
      if (this.requested !== entry.frame.key || entry.ready) return;
      entry.timedOut = true;
      this.showFailure(entry);
      this.status('error');
    }, this.loadTimeout);
  }
  private warm() {
    clearTimeout(this.warmTimer);
    const key = this.requested;
    this.warmTimer = setTimeout(() => {
      if (this.requested !== key || !key || !this.entries.get(key)?.ready) return;
      // A single nearby capture leaves memory and bandwidth for the chosen view.
      for (const frame of this.nearby) {
        if(this.failedWarm.has(frame.key))continue;
        const warm = this.ensure(frame);
        if (!warm.ready) break;
      }
      this.trim();
    }, this.warmDelay);
  }
  private trim() {
    const preferred = new Set(this.nearby.map((frame) => frame.key));
    const removable = [...this.entries.values()]
      .filter(
        (entry) =>
          entry.frame.key !== this.requested &&
          entry.frame.key !== this.displayed,
      )
      .sort(
        (a, b) =>
          Number(preferred.has(a.frame.key)) -
            Number(preferred.has(b.frame.key)) || a.used - b.used,
      );
    while (this.entries.size > 2 && removable.length) {
      const entry = removable.shift()!;
      entry.layer.remove();
      entry.layer.off();
      this.entries.delete(entry.frame.key);
    }
  }
  dispose() {
    this.map.off('movestart',this.onMoveStart);
    this.map.off('moveend',this.onMoveEnd);
    clearTimeout(this.timer);
    clearTimeout(this.warmTimer);
    clearTimeout(this.loadTimer);
    this.requested = null;
    this.requestIdentity = '';
    this.signature = '';
    for (const entry of this.entries.values()) {
      entry.layer.remove();
      entry.layer.off();
    }
    this.entries.clear();this.failedWarm.clear();
  }
}
