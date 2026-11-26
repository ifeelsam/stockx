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

/**
 * Caps SOL drips for a public faucet: new wallets are free to make, so per-wallet limits cannot protect the funder.
 * Refuses past `perHour` drips in any hour, and whenever the funder would fall under `floorLamports`.
 * ponytail: in memory, so a restart resets the hour; the floor still holds.
 */
export class DripBudget {
  private drips: number[] = [];
  constructor(private perHour: number, private floorLamports: number) {}
  take(funderLamports: number, dripLamports: number, now = Date.now()): boolean {
    this.drips = this.drips.filter((t) => now - t < 3_600_000);
    if (this.drips.length >= this.perHour || funderLamports - dripLamports < this.floorLamports) return false;
    this.drips.push(now);
    return true;
  }
}
