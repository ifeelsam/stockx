import { DEFAULT_TIERS, multiplierOf, RARITY_NAMES, tierFor, type RarityName, type Tier } from "./tiers.js";

/** Triple symbol per rarity. Dust has no triple: it is a payout, not a win. */
export const WIN_SYMBOL: Record<number, string> = {
  10_000: "coin",
  20_000: "bolt",
  50_000: "star",
  100_000: "gem",
  500_000: "crown",
  1_000_000: "rocket",
  10_000_000: "bull",
};
export const FILLERS = ["leaf", "moon", "key", "cloud", "dice", "flame", "wave", "fish"] as const;

export type CardArt = {
  tier: number;
  rarity: RarityName;
  multiplierBps: number;
  /** 0.2, 1, 2, … (derived; bps is the on-chain truth) */
  multiplier: number;
  /** True only from Common (1×) up. Dust returns 20¢ and is never shown as a win. */
  win: boolean;
  /** 9 panel symbols, row-major 3x3. */
  panels: string[];
  /** Indices of the 3 matching panels (empty for Dust). */
  winningPanels: number[];
};

/** mulberry32: 32-bit integer math only, so web (V8) and mobile (Hermes) produce identical streams. */
function rng(seed: Uint8Array) {
  // Bytes 8..24 are independent of the tier roll (bytes 0..8), so art reveals nothing extra.
  let a = 0x9e3779b9;
  for (let i = 8; i < 24; i++) a = Math.imul(a ^ seed[i], 0x85ebca6b) + 0x7f4a7c15;
  a >>>= 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic art for a revealed card; the verify page recomputes this from the on-chain seed. */
export function cardArt(seed: Uint8Array, tiers: Tier[] = DEFAULT_TIERS): CardArt {
  if (seed.length !== 32) throw new Error("seed must be 32 bytes");
  if (tiers.length !== RARITY_NAMES.length) throw new Error("expected 8 rarity tiers");
  const tier = tierFor(seed, tiers);
  const multiplierBps = tiers[tier].multiplierBps;
  const rarity = RARITY_NAMES[tier] ?? "Dust";
  const win = multiplierBps >= 10_000;
  const rand = rng(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

  // Bag with each filler at most twice so a filler can never form a triple.
  const bag: string[] = FILLERS.flatMap((f) => [f, f]);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  const panels: string[] = [];
  let winningPanels: number[] = [];
  if (win) {
    const symbol = WIN_SYMBOL[multiplierBps] ?? pick(Object.values(WIN_SYMBOL));
    const slots = Array.from({ length: 9 }, (_, i) => i);
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    winningPanels = slots.slice(0, 3).sort((x, y) => x - y);
    let k = 0;
    for (let i = 0; i < 9; i++) panels.push(winningPanels.includes(i) ? symbol : bag[k++]);
  } else {
    for (let i = 0; i < 9; i++) panels.push(bag[i]);
  }
  return { tier, rarity, multiplierBps, multiplier: multiplierOf(tiers[tier]), win, panels, winningPanels };
}
