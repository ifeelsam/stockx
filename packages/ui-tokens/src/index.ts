/**
 * Design tokens shared by web (CSS vars / motion) and mobile (Reanimated / Skia).
 * Holo-cards direction: #0D0B14 ground, #F2EFFA card stock, #9DF3FF accent,
 * one hue per rarity. Type: Bricolage Grotesque (display) + Space Mono (numbers).
 */

export const colors = {
  ink: "#0D0B14",
  surface: "#1B1726",
  surfaceHi: "#241F33",
  line: "#2A2539",
  text: "#F2EFFA",
  textDim: "#A9A3BC",
  card: "#F2EFFA", // holo card stock
  cardInk: "#171320",
  accent: "#9DF3FF",
  money: "#9DF3FF", // gains, balances (the design uses the accent)
  gold: "#FFD84D", // Grail / brand accent
  danger: "#FF8A7A",
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
  dust: { key: "dust", label: "Dust", color: "#8F88A6", glow: "#6F6A80", symbol: "leaf", fx: "none", payout: "20¢ back" },
  common: { key: "common", label: "Common", color: "#B4AEC6", glow: "#8D879F", symbol: "coin", fx: "glow", payout: "money back" },
  uncommon: { key: "uncommon", label: "Uncommon", color: "#7BD88F", glow: "#3E8F55", symbol: "bolt", fx: "burst", payout: "2×" },
  rare: { key: "rare", label: "Rare", color: "#4FC3F7", glow: "#2596CE", symbol: "star", fx: "burst", payout: "5×" },
  epic: { key: "epic", label: "Epic", color: "#B18CFF", glow: "#7B4DFF", symbol: "gem", fx: "burst", payout: "10×" },
  legend: { key: "legend", label: "Legend", color: "#FF9F43", glow: "#E07C1C", symbol: "crown", fx: "shake", payout: "50×" },
  mythic: { key: "mythic", label: "Mythic", color: "#FF5C8A", glow: "#E0356A", symbol: "rocket", fx: "shake", payout: "100×" },
  grail: { key: "grail", label: "Grail", color: "#FFD84D", glow: "#C99A1A", symbol: "bull", fx: "jackpot", payout: "1,000×" },
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

// ---- brand mark: a card torn along a rising price line ("rip" + "stock") -------------------------------

export const LOGO = {
  viewBox: "10 0 44 60",
  /** width ÷ height of the viewBox */
  ratio: 44 / 60,
  /** the torn-off top, in card white */
  top: "M12 11A9 9 0 0 1 21 2H43A9 9 0 0 1 52 11V13L44 21L38 17L28 29L21 25L12 34Z",
  /** the rest of the card, in the holo gradient (bottom-left to top-right) */
  bottom: "M12 42L21 33L28 37L38 25L44 29L52 21V49A9 9 0 0 1 43 58H21A9 9 0 0 1 12 49Z",
  holo: ["#FF6EC7", "#B18CFF", "#9DF3FF"],
} as const;

// ---- holo card + pack finishes (design canvas "B · Holo cards"); used by web and mobile -------------

export type CardFinish = {
  /** solid frame colour (first stop where the web draws a gradient) */
  frame: string;
  /** holo opacity inside the art window / over the whole card (0 = matte) */
  holo: number;
  cardHolo: number;
  /** full-bleed art behind the text (Mythic, Grail) */
  full: boolean;
  filledBadge: boolean;
  sparkle: boolean;
};

export const FINISH: Record<TierKey, CardFinish> = {
  dust: { frame: "#24202F", holo: 0, cardHolo: 0, full: false, filledBadge: false, sparkle: false },
  common: { frame: "#3A3550", holo: 0, cardHolo: 0, full: false, filledBadge: false, sparkle: false },
  uncommon: { frame: "#3E8F55", holo: 0.2, cardHolo: 0, full: false, filledBadge: false, sparkle: false },
  rare: { frame: "#4FC3F7", holo: 0.7, cardHolo: 0, full: false, filledBadge: false, sparkle: false },
  epic: { frame: "#7B4DFF", holo: 0.85, cardHolo: 0.18, full: false, filledBadge: true, sparkle: false },
  legend: { frame: "#FF9F43", holo: 0.9, cardHolo: 0.32, full: false, filledBadge: true, sparkle: false },
  mythic: { frame: "#FF6EC7", holo: 0.95, cardHolo: 0.22, full: true, filledBadge: true, sparkle: false },
  grail: { frame: "#FFD84D", holo: 1, cardHolo: 0.25, full: true, filledBadge: true, sparkle: true },
};

export type StockLook = { symbol: string; company: string; packName: string; pack: string; art: string };
export const STOCK_LOOK: Record<"TSLA" | "NVDA" | "SOL", StockLook> = {
  TSLA: { symbol: "TSLA", company: "Tesla", packName: "Tesla", pack: "#FF5B2E", art: "#FF5B2E" },
  NVDA: { symbol: "NVDA", company: "Nvidia", packName: "Nvidia", pack: "#1FAF6A", art: "#1FAF6A" },
  SOL: { symbol: "SOL", company: "Solana", packName: "Solana \u00b7 24/7", pack: "#8F6BFF", art: "#5B3FA8" },
};

// ---- what screens say about money, odds and cards (shared so web and mobile never disagree) ----------

export const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** The value printed on a card: beside "1,000\u00d7" the cents do not fit. */
export const cardUsd = (n: number) => (n >= 100 ? `$${n.toLocaleString("en-US")}` : money(n));
/** "\u25b2 $1.20" or "\u25bc $0.30"; under half a cent is flat, not a loss. */
export const change = (d: number) => ({ text: `${d <= -0.005 ? "\u25bc" : d >= 0.005 ? "\u25b2" : "\u00b1"} ${money(Math.abs(d))}`, down: d <= -0.005 });
export const serialOf = (id: number) => String(id).padStart(6, "0");
export const oddsText = (weight: number, total: number) => (weight / total > 0.5 ? `~${Math.round((weight / total) * 100)}%` : `1 in ${Math.round(total / weight).toLocaleString("en-US")}`);

export type Feed = keyof typeof STOCK_LOOK;
export type CardFace = {
  feed: Feed;
  rarity: TierKey;
  mult: string;
  usd: string;
  shares: string;
  now?: string;
  serial: string;
  /** 0..1: angle of the holo sweep (derived from the seed for real cards) */
  tilt?: number;
};

/** Everything a screen says about one revealed card. Dust is a partial refund, never a win. */
export function describeCard(
  c: { id: number; seed?: Uint8Array; art: { multiplier: number }; shares: number; lockedPrice: number },
  s: { feed: Feed; ticker: string; ticketUsd: number },
  price: number,
) {
  const t = tierByMultiplier(c.art.multiplier);
  const usd = c.art.multiplier * s.ticketUsd;
  const value = c.shares * (price || c.lockedPrice);
  const mult = `${c.art.multiplier.toLocaleString("en-US")}\u00d7`;
  const face: CardFace = {
    feed: s.feed,
    rarity: t.key,
    mult,
    usd: cardUsd(usd),
    shares: `${c.shares.toFixed(6)} shares`,
    now: `now ${money(value)} ${value >= c.shares * c.lockedPrice ? "\u25b2" : "\u25bc"}`,
    serial: serialOf(c.id),
    tilt: c.seed ? c.seed[24] / 255 : 0.35,
  };
  const caption =
    t.key === "dust"
      ? { title: "Dust", sub: `${Math.round(usd * 100)}\u00a2 back in ${s.ticker}` }
      : t.key === "common"
        ? { title: "Common 1\u00d7", sub: `money back \u00b7 ${money(usd)} in ${s.ticker}` }
        : { title: `${t.label} ${mult}`, sub: `${money(usd)} in ${s.ticker} \u00b7 up ${money(usd - s.ticketUsd)}` };
  return { tier: t, usd, value, face, caption };
}

/** Foil pouch outline as an SVG path (220\u00d7330): crimped top and bottom seals, pinched sides. */
export const PACK_PATH = (() => {
  const W = 220, H = 330, Z = 5, n = 22, S = 26;
  let d = `M 0 ${Z}`;
  for (let k = 1; k <= n; k++) d += ` L ${((k * W) / n).toFixed(1)} ${k % 2 ? 0 : Z}`;
  d += ` L ${W} ${S} C ${W - 1} ${S + 6} ${W - 9} ${S + 10} ${W - 8} ${S + 22}`;
  d += ` C ${W + 1} ${H * 0.36} ${W + 1} ${H * 0.64} ${W - 8} ${H - S - 22} C ${W - 9} ${H - S - 10} ${W - 1} ${H - S - 6} ${W} ${H - S} L ${W} ${H - Z}`;
  for (let k = n - 1; k >= 0; k--) d += ` L ${((k * W) / n).toFixed(1)} ${k % 2 ? H : H - Z}`;
  d += ` L 0 ${H - S} C 1 ${H - S - 6} 9 ${H - S - 10} 8 ${H - S - 22} C -1 ${H * 0.64} -1 ${H * 0.36} 8 ${S + 22} C 9 ${S + 10} 1 ${S + 6} 0 ${S} Z`;
  return d;
})();
