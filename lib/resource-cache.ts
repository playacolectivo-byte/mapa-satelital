/** Immutable, byte-bounded results with one physical request per resource.
 * Aborting one reader never cancels another reader of the same year. */
export class ResourceCache<T> {
  private values = new Map<string, { value: T; weight: number }>();
  private pending = new Map<string, { controller: AbortController; promise: Promise<T>; readers: number; settled: boolean }>();
  private weight = 0;
  private maximumEntries: number;
  private maximumWeight: number;

  constructor(maximumEntries: number, maximumWeight: number) {
    this.maximumEntries = maximumEntries; this.maximumWeight = maximumWeight;
  }

  peek(key:string):T|undefined { return this.values.get(key)?.value; }

  read(key: string, signal: AbortSignal, load: (signal: AbortSignal) => Promise<T>, weight = 1): Promise<T> {
    if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    const cached = this.values.get(key);
    if (cached) {
      this.values.delete(key); this.values.set(key, cached);
      return Promise.resolve(cached.value);
    }
    let request = this.pending.get(key);
    if (!request || request.controller.signal.aborted) {
      const controller = new AbortController();
      const next = { controller, promise: null as unknown as Promise<T>, readers: 0, settled: false };
      next.promise = Promise.resolve().then(() => load(controller.signal)).then(value => {
        // An obsolete request whose loader ignored cancellation cannot replace
        // the result of a later request for the same key.
        if (!controller.signal.aborted) this.remember(key, value, weight);
        return value;
      }).finally(() => {
        next.settled = true;
        if (this.pending.get(key) === next) this.pending.delete(key);
      });
      this.pending.set(key, next); request = next;
    }
    const shared = request;
    shared.readers++;
    return new Promise<T>((resolve, reject) => {
      let done = false;
      const release = () => {
        if (done) return false;
        done = true; signal.removeEventListener('abort', abort); shared.readers--;
        if (!shared.readers && !shared.settled) queueMicrotask(() => {
          if (!shared.readers && !shared.settled) shared.controller.abort();
        });
        return true;
      };
      const abort = () => { if (release()) reject(new DOMException('Aborted', 'AbortError')); };
      signal.addEventListener('abort', abort, { once: true });
      shared.promise.then(value => { if (release()) resolve(value); }, error => { if (release()) reject(error); });
      if (signal.aborted) abort();
    });
  }

  private remember(key: string, value: T, rawWeight: number) {
    const weight = Number.isFinite(rawWeight) ? Math.max(1, rawWeight) : 1;
    if (weight > this.maximumWeight || this.maximumEntries < 1) return;
    const previous = this.values.get(key);
    if (previous) { this.weight -= previous.weight; this.values.delete(key); }
    this.values.set(key, { value, weight }); this.weight += weight;
    while (this.values.size > this.maximumEntries || this.weight > this.maximumWeight) {
      const oldest = this.values.keys().next().value!;
      this.weight -= this.values.get(oldest)!.weight; this.values.delete(oldest);
    }
  }
}
