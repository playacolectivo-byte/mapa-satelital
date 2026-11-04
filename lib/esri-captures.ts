import { ESRI_PROJECT_FIRST_YEAR } from './calendar-time.ts';
import type { WaybackItem, WaybackMetadata } from '@esri/wayback-core';

export type LocalEsriCapture = {
  key: string;
  date: string;
  year: number;
  item: WaybackItem;
  metadata: WaybackMetadata;
  editions: WaybackItem[];
};

export function metadataCaptureDate(metadata: WaybackMetadata | null | undefined): string | null {
  if (!metadata || !Number.isFinite(metadata.date)) return null;
  const value = new Date(metadata.date);
  return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : null;
}

export function isVerifiedHdYear(year:number,requestedYear:number|undefined,date:string|null|undefined,resolution:number|null|undefined):boolean {
  return requestedYear===year && Number(date?.slice(0,4))===year && typeof resolution==='number' && Number.isFinite(resolution) && resolution>0 && resolution<=1;
}

/** One stop per dated acquisition at this point and zoom. Neither publication
 * dates nor observations at another point are admissible capture dates. Multiple
 * editions on the same day are kept as provenance, not presented as changes. */
export function distinctLocalCaptures(
  items: WaybackItem[],
  metadata: Record<number, WaybackMetadata>,
  today = new Date().toISOString().slice(0, 10),
  firstYear = 1900,
): LocalEsriCapture[] {
  const groups = new Map<string, { item: WaybackItem; metadata: WaybackMetadata }[]>();
  for (const item of items) {
    const value = metadata[item.releaseNum];
    const capture = metadataCaptureDate(value);
    if (!capture || capture > today || Number(capture.slice(0, 4)) < firstYear || item.releaseDateLabel > today) continue;
    const group = groups.get(capture) ?? [];
    if (!group.some((entry) => entry.item.releaseNum === item.releaseNum)) group.push({ item, metadata: value });
    groups.set(capture, group);
  }
  return [...groups].map(([capture, group]) => {
    // Pick the latest published edition of the same dated capture. A provider
    // rename (DigitalGlobe/Maxar/Vantor) must not invent another photograph.
    group.sort((a, b) => b.item.releaseDateLabel.localeCompare(a.item.releaseDateLabel) || b.item.releaseNum - a.item.releaseNum);
    return {
      key: 'esri-capture:' + capture,
      date: capture,
      year: Number(capture.slice(0, 4)),
      item: group[0].item,
      metadata: group[0].metadata,
      editions: group.map((entry) => entry.item),
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

/** An explicit date is exact. Missing metadata never authorizes a different
 * photograph or a neighbouring year. Initial suggestions are not UI actions. */
export function chooseLocalCapture(captures: LocalEsriCapture[], preferredDate: string | null): LocalEsriCapture | null {
  if (!captures.length) return null;
  if (!preferredDate) return captures[captures.length - 1];
  return captures.find((capture) => capture.date === preferredDate) ?? null;
}

/** An annual calendar never substitutes the nearest year or advances on pan. */
export function captureForCalendarYear(captures: LocalEsriCapture[], year: number, currentDate: string | null): LocalEsriCapture | null {
  const exact = captures.filter(capture => capture.year === year);
  return exact.find(capture => capture.date === currentDate) ?? exact.at(-1) ?? null;
}

/** Keep the selected edition when another edition of the same photograph is
 * discovered. Selecting a date must not replay the same photograph again. */
export function editionForCapture(capture: LocalEsriCapture, selectedRelease: number | undefined): WaybackItem {
  return capture.editions.find((item) => item.releaseNum === selectedRelease) ?? capture.item;
}

export type ScopedPointMetadata = { key: string; values: Record<number, WaybackMetadata>; errors: Record<number, true> };
/** Late replies from a previous center/zoom cannot replace the current point.
 * Within the same view, replies accumulate rather than replacing the list. */
export function mergePointMetadata(
  previous: ScopedPointMetadata | null,
  activeViewKey: string | null,
  result: { viewKey: string; release: number; value?: WaybackMetadata | null; error?: boolean },
): ScopedPointMetadata | null {
  if (result.viewKey !== activeViewKey) return previous;
  const current = previous?.key === activeViewKey ? previous : { key: activeViewKey, values: {}, errors: {} };
  if (result.value) {
    if (current.values[result.release] === result.value && !current.errors[result.release]) return previous;
    const errors = { ...current.errors };
    delete errors[result.release];
    return { key: activeViewKey, values: { ...current.values, [result.release]: result.value }, errors };
  }
  if (!result.error || current.values[result.release] || current.errors[result.release]) return previous;
  return { ...current, errors: { ...current.errors, [result.release]: true } };
}

/** Resolve a frozen stop by its dated identity in the latest metadata. A
 * removed/corrected capture never authorizes the nearest year as a fallback. */
export function resolveCaptureStop(stops: LocalEsriCapture[], live: LocalEsriCapture[], index: number): LocalEsriCapture | null {
  const stop = stops[Math.round(index)];
  return stop ? live.find((capture) => capture.key === stop.key) ?? null : null;
}

/** The range is a snapshot for the duration of a gesture. New dated metadata
 * updates the live list without moving its stops under the visitor's pointer. */
export type CaptureGesture = { scope: string; captures: LocalEsriCapture[] };
export function captureOptions(scope: string, live: LocalEsriCapture[], gesture: CaptureGesture | null): LocalEsriCapture[] {
  return gesture?.scope === scope ? gesture.captures : live;
}
export function captureIndex(captures: LocalEsriCapture[], date: string | null): number | null {
  if (!date) return null;
  const index = captures.findIndex((capture) => capture.date === date);
  return index < 0 ? null : index;
}
export function selectedCapture(scope: string, live: LocalEsriCapture[], gesture: CaptureGesture | null, index: number): LocalEsriCapture | null {
  if (gesture && gesture.scope !== scope) return null;
  return resolveCaptureStop(captureOptions(scope, live, gesture), live, index);
}

export type PublishedCaptureList=CaptureGesture & {locked:boolean};
/** New discoveries are published atomically after a query batch. A visitor's
 * first interaction locks that list until they explicitly refresh its dates. */
export function publishCaptureList(previous:PublishedCaptureList|null,scope:string,live:LocalEsriCapture[],force=false):PublishedCaptureList{
  if(previous?.scope===scope && previous.locked && !force)return previous;
  const signature=(values:LocalEsriCapture[])=>values.map(value=>value.key+':'+value.item.releaseNum).join('|');
  if(previous?.scope===scope && signature(previous.captures)===signature(live) && !force)return previous;
  return {scope,captures:[...live],locked:false};
}
export function lockCaptureList(previous:PublishedCaptureList|null,scope:string,stops:LocalEsriCapture[]):PublishedCaptureList{
  return previous?.scope===scope && previous.locked?previous:{scope,captures:[...stops],locked:true};
}

export type PointProbeState = { status: 'loading' | 'ready' | 'error'; attempted: number; failures: number; running: number };
export type PointProbeJob<T> = { key: string; read: (signal:AbortSignal) => Promise<T | null>; onValue: (value: T | null) => void; onError: () => void };
type ProbeContext<T> = { pending: Map<string, PointProbeJob<T>>; requested: Set<string>; failures: number; onState: (state: PointProbeState) => void };

/** One bounded pool for the component, including requests from a prior view.
 * The SDK cannot abort getMetadata. A UI deadline therefore DOES NOT release a
 * physical request slot; rapid pans must not create unbounded hidden requests. */
export class PointMetadataProbeQueue<T> {
  private contexts = new Map<string, ProbeContext<T>>();
  private active: string | null = null;
  private running = 0;
  private serviceFailures = 0;
  private disposed = false;
  private inFlight = new Map<string, { subscribers: { scope: string; job: PointProbeJob<T> }[]; failed: boolean; controller:AbortController }>();
  private options: { maximum: number; concurrency: number; failureLimit: number; timeoutMs: number };
  constructor(options = { maximum: 24, concurrency: 2, failureLimit: 3, timeoutMs: 15000 }) {
    this.options = { ...options, maximum: Math.max(0, Math.min(24, options.maximum)), concurrency: Math.max(1, Math.min(2, options.concurrency)), failureLimit: Math.max(1, Math.min(3, options.failureLimit)) };
  }
  activate(scope: string | null, onState?: (state: PointProbeState) => void) {
    this.disposed = false;
    this.active = scope;
    for (const [key, value] of this.contexts) if (key !== scope) value.pending.clear();
    if (scope !== null) {
      let context = this.contexts.get(scope);
      if (!context) {
        context = { pending: new Map(), requested: new Set(), failures: 0, onState: onState ?? (() => {}) };
        this.contexts.set(scope, context);
      } else if (onState) context.onState = onState;
      // The success cache is separate; old ledgers need not grow forever.
      while (this.contexts.size > 8) {
        const oldest = this.contexts.keys().next().value!;
        if (oldest === scope) break;
        this.contexts.delete(oldest);
      }
    }
    // Cancel genuinely abortable HTTP work belonging only to an obsolete view.
    // Defer across StrictMode's detach/reattach. Slots release only when the
    // underlying promise settles, so non-abortable jobs still respect the cap.
    queueMicrotask(()=>{
      for(const request of this.inFlight.values())if(!request.subscribers.some(s=>s.scope===this.active))request.controller.abort();
    });
    this.publish();
    this.drain();
  }
  offer(scope: string, jobs: PointProbeJob<T>[]) {
    const context = this.contexts.get(scope);
    if (scope !== this.active || !context || this.disposed) return;
    const ordered = new Map<string, PointProbeJob<T>>();
    for (const job of jobs) {
      if (context.requested.has(job.key)) continue;
      const running = this.inFlight.get(job.key);
      if (running) {
        if (context.requested.size >= this.options.maximum) continue;
        context.requested.add(job.key);
        running.subscribers.push({ scope, job });
        if (running.failed) job.onError();
      } else ordered.set(job.key, job);
    }
    for (const [key, job] of context.pending) if (!ordered.has(key)) ordered.set(key, job);
    context.pending = new Map([...ordered].slice(0, Math.max(0, this.options.maximum - context.requested.size)));
    this.publish();
    this.drain();
  }
  retry() {
    this.serviceFailures = 0;
    if (this.active) this.contexts.delete(this.active);
  }
  dispose() {
    this.disposed = true;
    this.active = null;
    this.contexts.clear();
    for(const request of this.inFlight.values())request.controller.abort();
  }
  private publish() {
    const context = this.active ? this.contexts.get(this.active) : null;
    if (!context || this.disposed) return;
    const hasWork = context.pending.size > 0 && context.requested.size < this.options.maximum;
    // A timed-out SDK promise still holds its physical slot. If every occupied
    // slot has timed out, show the failure instead of an endless loading label.
    const stalled = this.running > 0 && [...this.inFlight.values()].every((request) => request.failed);
    context.onState({
      status: Math.max(this.serviceFailures,context.failures) >= this.options.failureLimit || stalled ? 'error' : this.running > 0 || hasWork ? 'loading' : 'ready',
      attempted: context.requested.size, failures: Math.max(this.serviceFailures,context.failures), running: this.running,
    });
  }
  private drain() {
    const scope = this.active;
    const context = scope ? this.contexts.get(scope) : null;
    if (!scope || !context || this.disposed) return;
    while (this.running < this.options.concurrency && Math.max(this.serviceFailures,context.failures) + this.running < this.options.failureLimit && context.requested.size < this.options.maximum && context.pending.size) {
      const [key, job] = context.pending.entries().next().value!;
      context.pending.delete(key);
      if (context.requested.has(key)) continue;
      context.requested.add(key);
      this.running++;
      const request = { subscribers: [{ scope, job }], failed: false, controller:new AbortController() };
      this.inFlight.set(key, request);
      const fail = (error?:unknown) => {
        if (request.failed) return;
        if(request.controller.signal.aborted){
          for(const s of request.subscribers){const ctx=this.contexts.get(s.scope);ctx?.requested.delete(key);if(s.scope===this.active)ctx?.pending.set(key,s.job);}
          return;
        }
        request.failed = true;
        // Authorization/rate-limit failures remain service-wide. Transient
        // errors belong to their exact view; an obsolete request cannot stop
        // the new point's inventory, and successful responses break the streak.
        if(/\b(?:401|403|429)\b/.test(String(error)))this.serviceFailures++;
        for(const subscriberScope of new Set(request.subscribers.map(s=>s.scope))){
          const ctx=this.contexts.get(subscriberScope);if(ctx)ctx.failures++;
        }
        for (const entry of request.subscribers) if (!this.disposed && entry.scope === this.active) entry.job.onError();
        this.publish();
      };
      const timer = this.options.timeoutMs > 0 ? setTimeout(()=>{fail();request.controller.abort();}, this.options.timeoutMs) : undefined;
      void Promise.resolve().then(()=>job.read(request.controller.signal)).then((value) => {
        if(!request.failed&&!request.controller.signal.aborted)for(const subscriberScope of new Set(request.subscribers.map(s=>s.scope))){
          const ctx=this.contexts.get(subscriberScope);if(ctx)ctx.failures=0;
        }
        if(!request.controller.signal.aborted)for (const entry of request.subscribers) if (!this.disposed && entry.scope === this.active) entry.job.onValue(value);
      }, fail).finally(() => {
        clearTimeout(timer);
        this.inFlight.delete(key);
        this.running--;
        this.publish();
        this.drain();
      });
    }
    this.publish();
  }
}

/** A small queue of existing point queries, with old and new editions included.
 * Publication years rank requests only; they never become capture labels. */
export function metadataProbeQueue(items: WaybackItem[], selectedRelease: number | undefined, preferredReleases: number[] = [], maximum = 24): WaybackItem[] {
  const chronological = [...items].sort((a, b) => a.releaseDateLabel.localeCompare(b.releaseDateLabel));
  const ordered: WaybackItem[] = [];
  const add = (item: WaybackItem | undefined) => {
    if (item && !ordered.some((existing) => existing.releaseNum === item.releaseNum)) ordered.push(item);
  };
  add(chronological.find((item) => item.releaseNum === selectedRelease));
  // A nearby catalogue's first hint ranks a fresh query only. Its date is
  // never accepted at the new point without verifying that point's metadata.
  add(chronological.find((item) => item.releaseNum === preferredReleases[0]));
  add(chronological.at(-1));
  add(chronological[0]);
  for (const release of preferredReleases) add(chronological.find((item) => item.releaseNum === release));
  const publicationYears = new Set<string>();
  for (const item of [...chronological].reverse()) {
    const publicationYear = item.releaseDateLabel.slice(0, 4);
    if (!publicationYears.has(publicationYear)) { add(item); publicationYears.add(publicationYear); }
  }
  for (const item of [...chronological].reverse()) add(item);
  return ordered.slice(0, Math.max(0, maximum));
}

/** Keep decoded tiles during a same-year location check, never on a year change
 * or after a real mismatching/missing capture has been established. */
export function retainDatedEsriDuringProbe(confirmed:{year:number;release:number}|null, year:number, release:number|undefined, pending:boolean, actualDate:string|null):boolean {
  return pending && actualDate === null && confirmed?.year === year && confirmed.release === release;
}

/** Show an already verified exact-year capture while other years are still
 * being inventoried; later replies cannot redirect a valid selected photo. */
export function calendarCaptureToLoad(captures:LocalEsriCapture[],year:number,currentDate:string|null,paused=false):LocalEsriCapture|null {
  if(paused || Number(currentDate?.slice(0,4))===year)return null;
  return captureForCalendarYear(captures,year,currentDate);
}

/** An explicit navigation suggestion, never an automatic image substitution. */
export function nearestAvailableCapture(captures:LocalEsriCapture[],year:number):LocalEsriCapture|null {
  return [...captures].filter(capture=>Number.isFinite(Date.parse(capture.date)) && capture.year>=ESRI_PROJECT_FIRST_YEAR && capture.year<=new Date().getUTCFullYear() && capture.metadata.resolution>0 && capture.metadata.resolution<=1 && capture.year!==year)
    .sort((a,b)=>Math.abs(Number(a.date.slice(0,4))-year)-Math.abs(Number(b.date.slice(0,4))-year) || b.date.localeCompare(a.date))[0] ?? null;
}
