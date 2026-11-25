/** Prize-table math, byte-for-byte the on-chain rules so the verify page can recompute any card. */
export type Tier = { multiplierBps: number; weight: number };

/** Plan §1: Dust, Common, Uncommon, Rare, Epic, Legend, Mythic, Grail. 1× = 10,000 bps. */
export const DEFAULT_TIERS: Tier[] = [
  { multiplierBps: 2_000, weight: 76_025 }, // Dust 0.2×
  { multiplierBps: 10_000, weight: 12_500 }, // Common 1×
  { multiplierBps: 20_000, weight: 8_333 }, // Uncommon 2×
  { multiplierBps: 50_000, weight: 2_000 }, // Rare 5×
  { multiplierBps: 100_000, weight: 1_000 }, // Epic 10×
  { multiplierBps: 500_000, weight: 100 }, // Legend 50×
  { multiplierBps: 1_000_000, weight: 40 }, // Mythic 100×
  { multiplierBps: 10_000_000, weight: 2 }, // Grail 1,000×
];

/** Demo-only table: a Grail roughly every 20 cards. Never presented as the public table. */
export const DEMO_TIERS: Tier[] = DEFAULT_TIERS.map((t) =>
  t.multiplierBps === 10_000_000 ? { ...t, weight: 5_000 } : t.multiplierBps === 2_000 ? { ...t, weight: 71_027 } : t,
);

export const RARITY_NAMES = ["Dust", "Common", "Uncommon", "Rare", "Epic", "Legend", "Mythic", "Grail"] as const;
export type RarityName = (typeof RARITY_NAMES)[number];

export const totalWeight = (tiers: Tier[]) => tiers.reduce((a, t) => a + t.weight, 0);

/** Multiplier as a number (0.2, 1, 2, …) for display and animation buckets. */
export const multiplierOf = (t: Tier) => t.multiplierBps / 10_000;

/** RTP as a fraction of one ticket: Σ multiplier_bps·weight / (total_weight × 10,000). */
export const rtp = (tiers: Tier[]) =>
  tiers.reduce((a, t) => a + t.multiplierBps * t.weight, 0) / (totalWeight(tiers) * 10_000);

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

/** shares (1e-6 units) = multiplier_bps × ticket_usd ÷ 10,000 ÷ price; floors like the program. */
export function sharesFor(multiplierBps: number, ticketUsdE6: bigint, priceE8: bigint): bigint {
  if (priceE8 === 0n) throw new Error("zero price");
  return (BigInt(multiplierBps) * ticketUsdE6 * 100_000_000n) / (10_000n * priceE8);
}
