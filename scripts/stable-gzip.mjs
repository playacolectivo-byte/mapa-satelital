import { gzipSync } from 'node:zlib';

// Keep byte-for-byte export receipts portable between macOS and Linux.
// Only the gzip operating-system header is normalized; CSV bytes are untouched.
export function stableGzip(bytes) {
  const compressed = gzipSync(bytes);
  compressed[9] = 3;
  return compressed;
}
