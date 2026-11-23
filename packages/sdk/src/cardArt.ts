import { DEFAULT_TIERS, tierFor, type Tier } from "./tiers.js";

/** Panel symbols. Win symbol is chosen by the tier's multiplier; fillers never appear 3 times. */
export const WIN_SYMBOL: Record<number, string> = { 1: "coin", 2: "bolt", 5: "star", 10: "gem", 50: "crown", 100: "rocket", 1000: "bull" };
export const FILLERS = ["leaf", "moon", "key", "cloud", "dice", "flame", "wave", "fish"] as const;

export type CardArt = {
  tier: number;
  multiplier: number;
  win: boolean;
  /** 9 panel symbols, row-major 3x3. */
  panels: string[];
  /** Indices of the 3 matching panels (empty for a loss). */
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
  const tier = tierFor(seed, tiers);
  const multiplier = tiers[tier].multiplier;
  const win = multiplier > 0;
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
    const symbol = WIN_SYMBOL[multiplier] ?? pick(Object.values(WIN_SYMBOL));
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
  return { tier, multiplier, win, panels, winningPanels };
}
