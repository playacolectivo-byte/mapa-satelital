/** Retry only a failed visible tile, never reload the whole mosaic. */
export class TileRecovery {
  private pending = new Map<object, { timer?: ReturnType<typeof setTimeout>; attempts: number }>();
  private disposed = false;
  private delay:number;
  private maximum:number;
  constructor(delay = 350, maximum = 2) {this.delay=delay;this.maximum=maximum;}
  failed(tile: object, reload: () => void): boolean {
    if (this.disposed) return false;
    const entry = this.pending.get(tile) ?? { attempts: 0 };
    if (entry.attempts >= this.maximum) { this.cancel(tile); return false; }
    clearTimeout(entry.timer);
    entry.attempts++;
    entry.timer = setTimeout(() => {
      entry.timer = undefined;
      if (!this.disposed && this.pending.get(tile) === entry) reload();
    }, this.delay * entry.attempts);
    this.pending.set(tile, entry);
    return true;
  }
  cancel(tile: object) { clearTimeout(this.pending.get(tile)?.timer); this.pending.delete(tile); }
  dispose() { this.disposed = true; for (const tile of this.pending.keys()) this.cancel(tile); }
}
