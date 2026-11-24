import { DEFAULT_TIERS, type Tier } from "@scratchers/sdk/pure";

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
};

/** Mirrors scripts/src/setup.ts. Series 4 has the jackpot weight raised 2 → 5,000 (≈ 1 in 20). */
const DEMO_TIERS: Tier[] = DEFAULT_TIERS.map((t) =>
  t.multiplier === 1000 ? { ...t, weight: 5_000 } : t.multiplier === 0 ? { ...t, weight: 61_858 - 4_998 } : t,
);

export const SERIES: SeriesInfo[] = [
  { id: 1, name: "Tesla Scratcher", ticker: "mTSLA", feed: "TSLA", ticketUsd: 1, demo: false, alwaysOn: false, tiers: DEFAULT_TIERS, blurb: "Win tokenized Tesla. Pauses when US markets close." },
  { id: 2, name: "Nvidia Scratcher", ticker: "mNVDA", feed: "NVDA", ticketUsd: 1, demo: false, alwaysOn: false, tiers: DEFAULT_TIERS, blurb: "Win tokenized Nvidia. Pauses when US markets close." },
  { id: 3, name: "Solana Scratcher", ticker: "mSOL", feed: "SOL", ticketUsd: 1, demo: false, alwaysOn: true, tiers: DEFAULT_TIERS, blurb: "Crypto-priced, always on." },
  { id: 4, name: "Tesla · Demo Odds", ticker: "mTSLA", feed: "TSLA", ticketUsd: 1, demo: true, alwaysOn: false, tiers: DEMO_TIERS, blurb: "Boosted jackpot, about 1 in 20. For the demo only." },
];

export const seriesById = (id: number) => SERIES.find((s) => s.id === id) ?? SERIES[0];

export const TIER_NAMES = ["Lose", "Money back", "Double", "5x", "10x", "50x", "100x", "Jackpot"];
