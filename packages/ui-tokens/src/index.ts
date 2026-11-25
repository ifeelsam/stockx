/**
 * Design tokens shared by web (CSS vars / motion) and mobile (Reanimated / Skia).
 * Holo-cards direction: #0D0B14 ground, #F2EFFA card stock, #9DF3FF accent,
 * one hue per rarity. Type: Bricolage Grotesque (display) + Space Mono (numbers).
 */

export const colors = {
  ink: "#0D0B14",
  surface: "#15121F",
  surfaceHi: "#1D1929",
  line: "#2C2739",
  text: "#F2EFFA",
  textDim: "#9A93AE",
  card: "#F2EFFA", // holo card stock
  cardInk: "#171320",
  accent: "#9DF3FF",
  money: "#6EF7A8", // wins, balances
  gold: "#F7D45C", // Grail / brand accent
  danger: "#FF6B7A",
  warn: "#FFB547",
  foil: "#1A1626", // pack/foil base
  foilHi: "#2A2438",
} as const;

export type TierKey = "dust" | "common" | "uncommon" | "rare" | "epic" | "legend" | "mythic" | "grail";

/** Index = on-chain tier index in the default series. */
export const TIER_KEYS: TierKey[] = ["dust", "common", "uncommon", "rare", "epic", "legend", "mythic", "grail"];

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
  /** how the payout is described to the player (Dust is never called a win) */
  payout: string;
};

export const TIERS: Record<TierKey, TierStyle> = {
  dust: { key: "dust", label: "Dust", color: "#8B8798", glow: "#4A4557", symbol: "leaf", fx: "none", payout: "20¢ back" },
  common: { key: "common", label: "Common", color: "#9DF3FF", glow: "#5BD8EA", symbol: "coin", fx: "glow", payout: "money back" },
  uncommon: { key: "uncommon", label: "Uncommon", color: "#6EF7A8", glow: "#2BCB7C", symbol: "bolt", fx: "burst", payout: "2×" },
  rare: { key: "rare", label: "Rare", color: "#6C8CFF", glow: "#3F63FF", symbol: "star", fx: "burst", payout: "5×" },
  epic: { key: "epic", label: "Epic", color: "#C084FC", glow: "#9B4DFF", symbol: "gem", fx: "burst", payout: "10×" },
  legend: { key: "legend", label: "Legend", color: "#FF7AD1", glow: "#FF3DB8", symbol: "crown", fx: "shake", payout: "50×" },
  mythic: { key: "mythic", label: "Mythic", color: "#FFA64D", glow: "#FF7A1A", symbol: "rocket", fx: "shake", payout: "100×" },
  grail: { key: "grail", label: "Grail", color: "#F7D45C", glow: "#FFD76A", symbol: "bull", fx: "jackpot", payout: "1,000×" },
};

export const tierByIndex = (i: number): TierStyle => TIERS[TIER_KEYS[i] ?? "dust"];

/** Map a multiplier to a rarity style (works for custom series too). */
export function tierByMultiplier(m: number): TierStyle {
  if (m >= 1000) return TIERS.grail;
  if (m >= 100) return TIERS.mythic;
  if (m >= 50) return TIERS.legend;
  if (m >= 10) return TIERS.epic;
  if (m >= 5) return TIERS.rare;
  if (m >= 2) return TIERS.uncommon;
  if (m >= 1) return TIERS.common;
  return TIERS.dust;
}

/** Milliseconds. Same numbers drive motion (web) and Reanimated (mobile). */
export const timing = {
  tap: 90,
  fast: 160,
  base: 260,
  slow: 480,
  packStagger: 70, // per card when fanning out 10 cards
  flip: 620,
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

/** Haptic pattern per fx bucket: vibrate durations in ms (mobile + navigator.vibrate on web). */
export const haptics: Record<TierStyle["fx"], number[]> = {
  none: [],
  glow: [20],
  burst: [30, 40, 30],
  shake: [40, 30, 40, 30, 80],
  jackpot: [60, 40, 60, 40, 60, 40, 120, 80, 250, 120, 400],
};

export const cardSize = { w: 300, h: 420, radius: 22 } as const;

/** 24x24 line-glyph paths for the panel symbols from the SDK's `cardArt` (stroke, no fill). */
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
