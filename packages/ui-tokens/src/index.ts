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
  lose: { key: "lose", label: "No win", color: "#5B6377", glow: "#2A2F3D", symbol: "leaf", fx: "none" },
  x1: { key: "x1", label: "Money back", color: "#7FD6B2", glow: "#19E39A", symbol: "coin", fx: "glow" },
  x2: { key: "x2", label: "Double", color: "#4FD1E8", glow: "#22B8D6", symbol: "bolt", fx: "burst" },
  x5: { key: "x5", label: "5x", color: "#6C8CFF", glow: "#4A6BFF", symbol: "star", fx: "burst" },
  x10: { key: "x10", label: "10x", color: "#A67CFF", glow: "#8A52FF", symbol: "gem", fx: "burst" },
  x50: { key: "x50", label: "50x", color: "#FF7AD1", glow: "#FF3DB8", symbol: "crown", fx: "shake" },
  x100: { key: "x100", label: "100x", color: "#FF9A4D", glow: "#FF7A1A", symbol: "rocket", fx: "shake" },
  jackpot: { key: "jackpot", label: "JACKPOT 1000x", color: "#F5C451", glow: "#FFD76A", symbol: "bull", fx: "jackpot" },
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

/** 24x24 line-glyph paths for the 15 panel symbols from the SDK's `cardArt` (stroke, no fill). Rendered per platform. */
export const SYMBOL_PATHS: Record<string, string> = {
  coin: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 4v10m-2.5-7.5c0-1 1-1.5 2.5-1.5s2.5.5 2.5 1.5-1 1.5-2.5 1.5-2.5.5-2.5 1.5 1 1.5 2.5 1.5 2.5-.5 2.5-1.5",
  bolt: "M13 2L5 14h6l-1 8 8-12h-6z",
  star: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z",
  gem: "M6 4h12l4 6-10 11L2 10zM2 10h20M9 4l-2 6 5 11 5-11-2-6",
  crown: "M3 18h18l1-11-5 4-5-7-5 7-5-4zM3 21h18",
  rocket: "M12 2c3 2 5 6 5 10l-2 4H9l-2-4c0-4 2-8 5-10zM9 16l-3 4 4-1m5-3l3 4-4-1M12 9.5a1.5 1.5 0 100 .01",
  bull: "M3 4c0 4 2 6 5 6m13-6c0 4-2 6-5 6M8 10c-1 3-1 6 1 9h6c2-3 2-6 1-9M10 15h.01M14 15h.01M9.5 19.5c1 1 4 1 5 0",
  leaf: "M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19l9-9",
  moon: "M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z",
  key: "M8 15a4 4 0 110-8 4 4 0 010 8zm3.5-2.5L21 12m-3-.5v3m-3-2.5v3",
  cloud: "M7 18a4 4 0 01-.5-8A5.5 5.5 0 0117 9a4.5 4.5 0 01.5 9z",
  dice: "M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01",
  flame: "M12 22c4 0 7-2.7 7-7 0-4-3-6-4-10-3 2-4 4-4 6-1.5-1-2-2-2-3-2 2-4 4-4 7 0 4.3 3 7 7 7z",
  wave: "M2 9c3-3 5 3 8 0s5 3 8 0 3 0 4 0M2 15c3-3 5 3 8 0s5 3 8 0 3 0 4 0",
  fish: "M3 12c3-5 9-6 14-2l4-3v10l-4-3c-5 4-11 3-14-2zM7.5 11.5h.01",
};
