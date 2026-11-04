'use client';
import { useState } from 'react';

export function CoastalCsvDownload({path='/data/littoral/changes-from-1986.csv.gz',filename='changes-from-1986.csv',label='Descargar mediciones · CSV'}:{path?:string;filename?:string;label?:string}={}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <><a className="compact-link" href={path} download aria-busy={busy} onClick={async (event) => {
    if (!('DecompressionStream' in window)) return;
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(false);
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error('CSV unavailable');
      const bytes = new Uint8Array(await response.arrayBuffer());
      const original = new Blob([bytes]);
      const csv = bytes[0] === 0x1f && bytes[1] === 0x8b
        ? await new Response(original.stream().pipeThrough(new DecompressionStream('gzip'))).blob()
        : original;
      const url = URL.createObjectURL(csv);
      const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setError(true); }
    finally { setBusy(false); }
  }}>{busy ? 'Preparando CSV…' : label}</a>{error && <p role="status">No se pudo descargar. <a href={path} download>Descargar CSV comprimido</a></p>}</>;
}
