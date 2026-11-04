// Cache successful values and share in-flight requests. Location and image
// level stay in the key: one mosaic's acquisition date is never moved elsewhere.
export class TimelineCache<T> {
  private values = new Map<string, T>();
  private requests = new Map<string, {promise:Promise<T | null>;signal?:AbortSignal}>();
  private maximum: number;
  constructor(maximum = 192) {
    this.maximum = maximum;
  }
  peek(key: string): T | undefined {
    return this.values.get(key);
  }
  load(key: string, read: () => Promise<T | null>, signal?:AbortSignal): Promise<T | null> {
    if(signal?.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
    const cached = this.values.get(key);
    if (cached !== undefined) {
      this.values.delete(key);
      this.values.set(key, cached);
      return Promise.resolve(cached);
    }
    const pending = this.requests.get(key);
    if (pending && !pending.signal?.aborted) return pending.promise;
    const request = Promise.resolve()
      .then(read)
      .then((value) => {
        if (value !== null && !signal?.aborted) {
          this.values.set(key, value);
          if (this.values.size > this.maximum)
            this.values.delete(this.values.keys().next().value!);
        }
        return value;
      })
      .finally(() => {if(this.requests.get(key)?.promise===request)this.requests.delete(key);});
    this.requests.set(key, {promise:request,signal});
    return request;
  }
}

export function captureMetadataKey(
  release: number,
  longitude: number,
  latitude: number,
  zoom: number,
) {
  return `${release}:${longitude},${latitude}:${zoom}`;
}

export async function readWithDeadline<T>(
  read: () => Promise<T>,
  milliseconds = 15000,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      read(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Metadata timeout')),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
