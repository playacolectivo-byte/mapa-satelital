import manifest from './generated/data-assets.json' with { type: 'json' };
type Asset={url:string;gzip_url?:string;bytes?:number};

/** Original JSON byte size is a conservative, reproducible cache budget unit;
 * it is not a claim about the browser's exact heap allocation. */
export function dataAssetBytes(path:string):number {
  return (manifest.assets as Record<string,Asset>)[path]?.bytes ?? 1024 * 1024;
}

export function dataAssetUrl(path: string): string {
  const asset = (manifest.assets as Record<string, Asset>)[path];
  return asset?.url ?? '/data/' + path;
}

class DataHttpError extends Error {
  readonly status:number;readonly retryAfter:string|null;
  constructor(status:number,retryAfter:string|null){super('Información no disponible');this.status=status;this.retryAfter=retryAfter;}
}

/** Compressed static assets work on ordinary static hosting, with a plain JSON
 * fallback for browsers without streaming decompression or incomplete uploads. */
export async function fetchJsonAsset<T>(url:string,signal:AbortSignal,gzipUrl?:string):Promise<T>{
  if(gzipUrl && typeof DecompressionStream!=='undefined'){
    try{
      const response=await fetch(gzipUrl,{signal});
      if(response.ok){
        // Fetch already decompresses when a host explicitly supplies this header.
        if(response.headers.get('content-encoding')?.includes('gzip'))return await response.json() as T;
        if(response.body)return await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json() as T;
      }else{
        await response.body?.cancel();
        if(![404,405,415].includes(response.status))throw new DataHttpError(response.status,response.headers.get('retry-after'));
      }
    }catch(error){if(signal.aborted || error instanceof DataHttpError)throw error;}
  }
  const response=await fetch(url,{signal});
  if(!response.ok){await response.body?.cancel();throw new DataHttpError(response.status,response.headers.get('retry-after'));}
  return await response.json() as T;
}

function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Static, content-addressed data: browser/CDN cache, bounded retry, no data API. */
export async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = setTimeout(abort, 25000);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const asset=(manifest.assets as Record<string,Asset>)[path];
        return await fetchJsonAsset<T>(dataAssetUrl(path),controller.signal,asset?.gzip_url);
      } catch (error) {
        if (controller.signal.aborted || attempt === 1) throw error;
        if(error instanceof DataHttpError && ![429,502,503,504].includes(error.status))throw error;
        const seconds=error instanceof DataHttpError?Number(error.retryAfter):NaN;
        await pause(Number.isFinite(seconds)&&seconds>0?Math.min(seconds*1000,2000):250+Math.random()*250,controller.signal);
      }
    }
    throw new Error('Información no disponible');
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}
