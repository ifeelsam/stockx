/** Prize-table math, byte-for-byte the on-chain rules so the verify page can recompute any card. */
export type Tier = { multiplier: number; weight: number };

export const DEFAULT_TIERS: Tier[] = [
  { multiplier: 0, weight: 61_858 },
  { multiplier: 1, weight: 25_000 },
  { multiplier: 2, weight: 10_000 },
  { multiplier: 5, weight: 2_000 },
  { multiplier: 10, weight: 1_000 },
  { multiplier: 50, weight: 100 },
  { multiplier: 100, weight: 40 },
  { multiplier: 1000, weight: 2 },
];

export const totalWeight = (tiers: Tier[]) => tiers.reduce((a, t) => a + t.weight, 0);

/** RTP as a fraction of one ticket: Σ multiplier·weight / total_weight. */
export const rtp = (tiers: Tier[]) => tiers.reduce((a, t) => a + t.multiplier * t.weight, 0) / totalWeight(tiers);

/** u64 from seed[0..8] (little endian) mod total_weight → tier index. */
export function tierFor(seed: Uint8Array, tiers: Tier[]): number {
  const r = new DataView(seed.buffer, seed.byteOffset, 8).getBigUint64(0, true) % BigInt(totalWeight(tiers));
  let acc = 0n;
  for (let i = 0; i < tiers.length; i++) {
    acc += BigInt(tiers[i].weight);
    if (r < acc) return i;
  }
  throw new Error("weights do not sum to total_weight");
}

/** shares (1e-6 units) = multiplier × ticket_usd ÷ price; floors like the program. price: 1e8 fixed point. */
export function sharesFor(multiplier: number, ticketUsdE6: bigint, priceE8: bigint): bigint {
  if (priceE8 === 0n) throw new Error("zero price");
  return (BigInt(multiplier) * ticketUsdE6 * 100_000_000n) / priceE8;
}
