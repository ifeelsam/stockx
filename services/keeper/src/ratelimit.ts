/** Per-key cooldown limiter (faucet: one claim per wallet per window). */
export class Cooldown {
  private last = new Map<string, number>();
  constructor(private windowMs: number) {}
  /** Returns 0 if allowed (and records the claim), else ms remaining. */
  take(key: string, now = Date.now()): number {
    const prev = this.last.get(key);
    if (prev !== undefined && now - prev < this.windowMs) return this.windowMs - (now - prev);
    this.last.set(key, now);
    if (this.last.size > 10_000) for (const [k, t] of this.last) if (now - t >= this.windowMs) this.last.delete(k);
    return 0;
  }
}
