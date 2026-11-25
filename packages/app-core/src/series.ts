import { DEFAULT_TIERS, DEMO_TIERS, RARITY_NAMES, type Tier } from "@scratchers/sdk/pure";

export type SeriesInfo = {
  id: number;
  name: string;
  /** stock ticker shown to the user */
  ticker: string;
  feed: "TSLA" | "NVDA" | "SOL";
  ticketUsd: number;
  demo: boolean;
  /** crypto-priced: keeps the app open while US markets are closed */
  alwaysOn: boolean;
  tiers: Tier[];
  blurb: string;
  /** deployed on-chain but not offered in the UI (NVDA: price grant missing; SOL: only existed to cover market closures) */
  hidden?: boolean;
};

/**
 * Series ids 11–14 are the rarity-table (multiplier_bps) deployment. Ids 1–4 belong to the earlier
 * 0×/money-back layout and must not be reused: the Series account layout grew by 16 bytes, so the old
 * accounts cannot deserialize under the new program.
 */
export const SERIES: SeriesInfo[] = [
  { id: 11, name: "Tesla Holo Pack", ticker: "mTSLA", feed: "TSLA", ticketUsd: 1, demo: false, alwaysOn: false, tiers: DEFAULT_TIERS, blurb: "Rip a pack. Win tokenized Tesla from Dust to a 1,000× Grail." },
  { id: 12, name: "Nvidia Holo Pack", ticker: "mNVDA", feed: "NVDA", ticketUsd: 1, demo: false, alwaysOn: false, tiers: DEFAULT_TIERS, blurb: "Tokenized Nvidia, priced from the last market print.", hidden: true },
  { id: 13, name: "Solana Holo Pack", ticker: "mSOL", feed: "SOL", ticketUsd: 1, demo: false, alwaysOn: true, tiers: DEFAULT_TIERS, blurb: "Crypto-priced, always on.", hidden: true },
  { id: 14, name: "Tesla · Demo Odds", ticker: "mTSLA", feed: "TSLA", ticketUsd: 1, demo: true, alwaysOn: false, tiers: DEMO_TIERS, blurb: "Grail about 1 in 20. For the demo only, never the public table." },
];

/** What the apps offer. Hidden series stay deployed (their cards, if any, still render). */
export const VISIBLE_SERIES = SERIES.filter((s) => !s.hidden);

export const seriesById = (id: number) => SERIES.find((s) => s.id === id) ?? SERIES[0];

export const TIER_NAMES = [...RARITY_NAMES];
