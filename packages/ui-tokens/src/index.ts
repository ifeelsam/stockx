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

/**
 * "ripstokx" outlined from Bricolage Grotesque ExtraBold (OFL) at 100 units per em, so web and mobile draw
 * the same gradient. "rip" takes the rainbow, "stokx" the accent.
 */
export const WORDMARK = {
  viewBox: "6 -76 376 93",
  /** box height and width in em, to size it like text */
  h: 0.93,
  w: 3.76,
  /** x range of "rip", for its gradient */
  ripX: [6, 126],
  rainbow: ["#9DF3FF", "#B18CFF", "#FF6EC7"],
  rip: "M22.4 0L6.2 0L6.2-24.5L6.2-52.8L19.4-52.8L19.7-34.9L21.7-34.9Q22.4-41.9 24.4-46.1Q26.3-50.2 30.0-52.1Q33.6-54 39-54L39-54Q39.8-54 40.8-54.0Q41.8-53.9 43.1-53.7L43.1-53.7L42.5-36.5Q40.9-37.3 39.1-37.6Q37.2-37.8 35.8-37.8L35.8-37.8Q31.9-37.8 29.1-36.3Q26.2-34.8 24.6-31.7Q22.9-28.6 22.4-23.9L22.4-23.9L22.4 0ZM62.4 0L46.3 0L46.3-52.8L62.4-52.8L62.4 0ZM54.4-60.2L54.4-60.2Q49.8-60.2 47.4-62.2Q44.9-64.1 44.9-67.7L44.9-67.7Q44.9-71.5 47.4-73.5Q49.8-75.4 54.4-75.4L54.4-75.4Q59.1-75.4 61.6-73.5Q64-71.5 64-67.8L64-67.8Q64-64.1 61.6-62.2Q59.1-60.2 54.4-60.2ZM86.5 16.9L70.4 16.9L70.4-25.8L70.4-52.8L83.6-52.8L83.8-37.8L85.6-37.6Q86.5-43.2 88.8-46.9Q91.1-50.6 94.8-52.4Q98.4-54.2 103.1-54.2L103.1-54.2Q110.1-54.2 115.2-50.8Q120.2-47.4 122.9-41.1Q125.6-34.8 125.6-26L125.6-26Q125.6-18.2 123.3-12Q120.9-5.8 116.2-2.2Q111.4 1.4 104.1 1.4L104.1 1.4Q99.2 1.4 95.8-0.4Q92.4-2.1 90.1-5.5Q87.7-8.9 86.1-14L86.1-14L84.2-14Q84.8-11.3 85.3-8.5Q85.8-5.7 86.2-3.1Q86.5-0.5 86.5 1.9L86.5 1.9L86.5 16.9ZM98.2-11.3L98.2-11.3Q101.5-11.3 103.9-13.1Q106.2-14.9 107.5-18.2Q108.8-21.5 108.8-25.9L108.8-25.9Q108.8-30.6 107.5-34.0Q106.1-37.3 103.6-39.2Q101.1-41 97.8-41L97.8-41Q94.7-41 92.6-39.7Q90.4-38.3 89.1-36.1Q87.7-34 87.1-31.6Q86.5-29.2 86.5-27.1L86.5-27.1L86.5-24.9Q86.5-23 87-21.1Q87.5-19.2 88.5-17.4Q89.5-15.7 90.9-14.3Q92.3-12.9 94.2-12.1Q96-11.3 98.2-11.3Z",
  stokx: "M152.3 1.4L152.3 1.4Q147 1.4 142.7 0.5Q138.4-0.5 135.2-2.3Q132-4.1 129.9-6.7Q127.9-9.2 127.1-12.3L127.1-12.3L139.1-17.6Q139.8-15.9 141.6-14.2Q143.3-12.4 146.3-11.3Q149.2-10.2 153.4-10.2L153.4-10.2Q157.4-10.2 159.7-11.4Q161.9-12.5 161.9-14.7L161.9-14.7Q161.9-16.3 160.7-17.3Q159.4-18.2 156.9-18.9Q154.4-19.7 150.7-20.4L150.7-20.4Q146.9-21.2 143-22.3Q139.1-23.3 135.7-25.2Q132.3-27 130.3-30.1Q128.2-33.1 128.2-37.8L128.2-37.8Q128.2-42.7 130.8-46.4Q133.4-50 138.6-52.1Q143.7-54.2 151.1-54.2L151.1-54.2Q157.7-54.2 162.7-52.5Q167.7-50.8 171.1-47.7Q174.4-44.5 175.7-40.1L175.7-40.1L162.8-35.5Q162.3-37.7 160.8-39.3Q159.2-40.9 156.8-41.8Q154.5-42.6 151.3-42.6L151.3-42.6Q147.4-42.6 145.3-41.4Q143.1-40.2 143.1-38.2L143.1-38.2Q143.1-36.6 144.6-35.6Q146-34.5 148.7-33.8Q151.4-33.1 155.1-32.3L155.1-32.3Q159-31.5 162.8-30.5Q166.7-29.4 169.8-27.7Q173-25.9 174.8-23.1Q176.7-20.2 176.7-15.7L176.7-15.7Q176.7-10.4 173.9-6.6Q171.1-2.7 165.7-0.7Q160.2 1.4 152.3 1.4ZM201.7 1.3L201.7 1.3Q192.4 1.3 188-3.7Q183.6-8.6 183.6-19.5L183.6-19.5L183.6-40.2L176.1-40.2L176.4-52.7L181.8-52.7Q185-52.8 186.7-53.7Q188.3-54.6 188.7-57.1L188.7-57.1L190-64.5L199.1-64.5L199.1-52.8L211.8-52.8L211.8-39.7L199.1-39.7L199.1-20.2Q199.1-16.8 200.8-15.2Q202.4-13.6 205.8-13.6L205.8-13.6Q207.7-13.6 209.4-14Q211.1-14.4 212.2-15.1L212.2-15.1L212.2-0.2Q209 0.8 206.4 1.1Q203.7 1.3 201.7 1.3ZM241.5 1.4L241.5 1.4Q233.5 1.4 227.3-1.7Q221.2-4.8 217.7-11Q214.2-17.2 214.2-26.5L214.2-26.5Q214.2-35.8 217.7-42.0Q221.2-48.1 227.4-51.2Q233.6-54.2 241.6-54.2L241.6-54.2Q249.6-54.2 255.8-51.1Q262-48 265.5-41.9Q269-35.7 269-26.4L269-26.4Q269-16.9 265.4-10.7Q261.8-4.5 255.6-1.6Q249.3 1.4 241.5 1.4ZM242-10.3L242-10.3Q245.6-10.3 248-12.0Q250.4-13.6 251.6-17Q252.8-20.4 252.8-25.4L252.8-25.4Q252.8-30.7 251.5-34.4Q250.2-38 247.7-40.0Q245.1-41.9 241.1-41.9L241.1-41.9Q237.7-41.9 235.3-40.3Q232.8-38.6 231.6-35.2Q230.4-31.8 230.4-26.7L230.4-26.7Q230.4-18.5 233.4-14.4Q236.5-10.3 242-10.3ZM289.7 0L273.9 0L273.9-72.1L289.7-72.1L289.7-32.3Q292.6-34.4 295.1-36.8Q297.7-39.2 299.8-41.8Q302-44.4 303.8-47.2Q305.5-49.9 306.8-52.8L306.8-52.8L325.2-52.8Q323.9-48.9 321.6-45.1Q319.3-41.2 316-38.0Q312.7-34.7 308.1-32.4Q303.6-30.1 297.9-29.3L297.9-29.3L297.9-27.5Q305.1-28.9 309.8-27.6Q314.4-26.2 317.2-23.2Q320-20.2 321.5-16.2Q323-12.2 324-8.3L324-8.3L326.1 0L308.6 0L307.6-5Q306.6-9.9 305.3-13.4Q303.9-16.9 301.4-18.9Q298.9-20.8 294.2-20.8L294.2-20.8L289.7-20.8L289.7 0ZM343.4 0L324.8 0L342.2-26.4L324.9-52.8L343.4-52.8L352.1-33.4L354-33.4L362.7-52.8L381.2-52.8L363.8-26.4L381.3 0L362.9 0L354-19.6L352.1-19.6L343.4 0Z",
} as const;

// ---- rarity splashes (design canvas "Rarity splashes"): each rarity escalates; Dust and Common get none --

export type Splash = {
  /** background, word colour, word size on a 390-wide phone */
  bg: string;
  word: string;
  size: number;
  /** strength of the central glow in the rarity colour, 0..1 */
  glow: number;
  rings: number;
  shards?: boolean;
  /** warp streaks flying out from the gem */
  warp?: string[];
  /** rotating sunburst behind the gem */
  rays?: { count: number; opacity: number };
  embers?: string[];
  prism?: boolean;
  sparkle?: boolean;
  blackout?: boolean;
};

const MYTHIC_PRISM = ["#FF5C8A", "#FEFF9C", "#7AFCFF", "#B28DFF"];
export const SPLASH: Partial<Record<TierKey, Splash>> = {
  uncommon: { bg: "#0B1A12", word: "#F2EFFA", size: 64, glow: 0.45, rings: 2 },
  rare: { bg: "#07161F", word: "#F2EFFA", size: 92, glow: 0.55, rings: 3, shards: true },
  epic: { bg: "#0E0820", word: "#F2EFFA", size: 100, glow: 0.6, rings: 3, shards: true, warp: ["#FFFFFF", "#C9B8FF", "#9DF3FF"] },
  legend: { bg: "#1F0E04", word: "#FFE2C2", size: 92, glow: 0.7, rings: 3, shards: true, rays: { count: 20, opacity: 0.32 }, embers: ["#FF9F43", "#FFD84D", "#FF5B2E"] },
  mythic: { bg: "#1A0612", word: "#FFFFFF", size: 92, glow: 0.5, rings: 3, shards: true, warp: MYTHIC_PRISM, prism: true },
  grail: { bg: "#0A0700", word: "#FFD84D", size: 104, glow: 0.65, rings: 4, shards: true, rays: { count: 30, opacity: 0.22 }, embers: ["#FFD84D", "#FFF3B0", "#FFB23F"], sparkle: true, blackout: true },
};
export const SPLASH_MS = 3200;

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
/** What a pull is "in": SOL is a token, not a share. */
export const holdingName = (feed: Feed) => (feed === "SOL" ? "SOL" : `${STOCK_LOOK[feed].company} shares`);
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
    shares: `${c.shares.toFixed(6)} ${s.feed === "SOL" ? "SOL" : "shares"}`,
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
