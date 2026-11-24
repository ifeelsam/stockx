/** Design tokens shared by web (CSS vars / motion) and mobile (Reanimated / Skia). Original palette. */

export const colors = {
  ink: "#0A0C10",
  surface: "#12151C",
  surfaceHi: "#1A1E28",
  line: "#262B38",
  text: "#F2F4F8",
  textDim: "#8B93A7",
  money: "#19E39A", // emerald: wins, balances
  gold: "#F5C451", // jackpot / brand accent
  danger: "#FF5D6C",
  warn: "#FFB547",
  foil: "#2A2F3D", // scratch layer base
  foilHi: "#3A4154",
} as const;

export type TierKey = "lose" | "x1" | "x2" | "x5" | "x10" | "x50" | "x100" | "jackpot";

/** Index = on-chain tier index in the default series. */
export const TIER_KEYS: TierKey[] = ["lose", "x1", "x2", "x5", "x10", "x50", "x100", "jackpot"];

export type TierStyle = {
  key: TierKey;
  label: string;
  /** primary colour */
  color: string;
  /** glow / secondary */
  glow: string;
  /** panel symbol (ASCII-safe glyph key; art lives in each app) */
  symbol: string;
  /** reveal intensity bucket, drives animation choice */
  fx: "none" | "glow" | "burst" | "shake" | "jackpot";
};

export const TIERS: Record<TierKey, TierStyle> = {
  lose: { key: "lose", label: "No win", color: "#5B6377", glow: "#2A2F3D", symbol: "dust", fx: "none" },
  x1: { key: "x1", label: "Money back", color: "#7FD6B2", glow: "#19E39A", symbol: "coin", fx: "glow" },
  x2: { key: "x2", label: "Double", color: "#4FD1E8", glow: "#22B8D6", symbol: "bolt", fx: "burst" },
  x5: { key: "x5", label: "5x", color: "#6C8CFF", glow: "#4A6BFF", symbol: "star", fx: "burst" },
  x10: { key: "x10", label: "10x", color: "#A67CFF", glow: "#8A52FF", symbol: "gem", fx: "burst" },
  x50: { key: "x50", label: "50x", color: "#FF7AD1", glow: "#FF3DB8", symbol: "crown", fx: "shake" },
  x100: { key: "x100", label: "100x", color: "#FF9A4D", glow: "#FF7A1A", symbol: "flame", fx: "shake" },
  jackpot: { key: "jackpot", label: "JACKPOT 1000x", color: "#F5C451", glow: "#FFD76A", symbol: "sun", fx: "jackpot" },
};

export const tierByIndex = (i: number): TierStyle => TIERS[TIER_KEYS[i] ?? "lose"];

/** Map a multiplier to a tier style (works for custom series too). */
export function tierByMultiplier(m: number): TierStyle {
  if (m >= 1000) return TIERS.jackpot;
  if (m >= 100) return TIERS.x100;
  if (m >= 50) return TIERS.x50;
  if (m >= 10) return TIERS.x10;
  if (m >= 5) return TIERS.x5;
  if (m >= 2) return TIERS.x2;
  if (m >= 1) return TIERS.x1;
  return TIERS.lose;
}

/** Milliseconds. Same numbers drive motion (web) and Reanimated (mobile). */
export const timing = {
  tap: 90,
  fast: 160,
  base: 260,
  slow: 480,
  packStagger: 70, // per card when fanning out 10 cards
  autoRevealDelay: 120,
  countUp: 1100,
  confetti: 1800,
  jackpot: 6000,
  shake: 420,
} as const;

/** cubic-bezier control points (x1,y1,x2,y2). */
export const easing = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
  spring: { stiffness: 380, damping: 26, mass: 0.9 },
} as const;

/** Fraction of the foil that must be cleared before we auto-reveal. */
export const SCRATCH_REVEAL_THRESHOLD = 0.6;

/** Haptic pattern per fx bucket: vibrate durations in ms (mobile + navigator.vibrate on web). */
export const haptics: Record<TierStyle["fx"], number[]> = {
  none: [],
  glow: [20],
  burst: [30, 40, 30],
  shake: [40, 30, 40, 30, 80],
  jackpot: [60, 40, 60, 40, 60, 40, 120, 80, 250, 120, 400],
};

export const cardSize = { w: 300, h: 400, radius: 20 } as const;
