"use client";
/**
 * Game state behind one hook. `mock` backend simulates the whole loop in the browser so every screen
 * works before the devnet deploy; the chain backend (SDK) plugs in behind the same shape.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cardArt, tierFor, sharesFor, type CardArt } from "@scratchers/sdk";
import { SERIES, seriesById } from "./series";

export type UiCardState = "pending" | "revealed" | "claiming" | "settled";
export type UiCard = {
  id: number;
  seriesId: number;
  state: UiCardState;
  seed?: Uint8Array;
  art?: CardArt;
  /** USD price per share locked at purchase, 1e8-scaled number */
  lockedPrice: number;
  /** shares won (float, 6 decimals) */
  shares: number;
  scratched: boolean;
};
export type Holding = { ticker: string; feed: "TSLA" | "NVDA" | "SOL"; shares: number; costUsd: number };
export type Prices = Record<"TSLA" | "NVDA" | "SOL", number>;

type Game = {
  backend: "mock" | "chain";
  usdc: number;
  prices: Prices;
  history: Record<keyof Prices, { t: number; v: number }[]>;
  marketClosed: boolean;
  setMarketClosed(v: boolean): void;
  degraded: boolean;
  cards: UiCard[];
  holdings: Holding[];
  buy(seriesId: number, n: number): Promise<number[]>;
  markScratched(id: number): void;
  claimAll(): Promise<void>;
  faucet(): Promise<void>;
  sell(ticker: string, shares: number): void;
  /** lifetime counters for the dashboard */
  stats: { sold: number; tierCounts: number[]; paidShares: number };
};

const Ctx = createContext<Game | null>(null);
export const useGame = () => {
  const g = useContext(Ctx);
  if (!g) throw new Error("GameProvider missing");
  return g;
};

const START: Prices = { TSLA: 248.31, NVDA: 141.07, SOL: 168.42 };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const isEquity = (feed: string) => feed !== "SOL";

export function GameProvider({ children }: { children: ReactNode }) {
  const [usdc, setUsdc] = useState(0);
  const [prices, setPrices] = useState<Prices>(START);
  const [history, setHistory] = useState<Game["history"]>(() => {
    const now = Math.floor(Date.now() / 1000);
    const mk = (p: number) => Array.from({ length: 60 }, (_, i) => ({ t: now - (60 - i) * 5, v: p }));
    return { TSLA: mk(START.TSLA), NVDA: mk(START.NVDA), SOL: mk(START.SOL) };
  });
  const [marketClosed, setMarketClosed] = useState(false);
  const [cards, setCards] = useState<UiCard[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [stats, setStats] = useState({ sold: 0, tierCounts: Array(8).fill(0) as number[], paidShares: 0 });
  const nextId = useRef(1);
  const pricesRef = useRef(prices);
  pricesRef.current = prices;

  // random-walk ticker standing in for rollup price pushes
  useEffect(() => {
    const iv = setInterval(() => {
      setPrices((p) => {
        const n = { ...p };
        (Object.keys(n) as (keyof Prices)[]).forEach((k) => {
          if (marketClosed && isEquity(k)) return;
          n[k] = Math.max(1, n[k] * (1 + (Math.random() - 0.5) * 0.0016));
        });
        return n;
      });
      const t = Math.floor(Date.now() / 1000);
      setHistory((h) => {
        const n = { ...h };
        (Object.keys(n) as (keyof Prices)[]).forEach((k) => {
          if (marketClosed && isEquity(k)) return;
          n[k] = [...h[k].slice(-299), { t, v: pricesRef.current[k] }];
        });
        return n;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [marketClosed]);

  const buy = useCallback(
    async (seriesId: number, n: number) => {
      const s = seriesById(seriesId);
      if (isEquity(s.feed) && marketClosed) throw new Error("Market closed: price paused");
      if (usdc < n * s.ticketUsd) throw new Error("Insufficient balance. Tap “Get test funds”.");
      const price = pricesRef.current[s.feed];
      const ids: number[] = [];
      const fresh: UiCard[] = Array.from({ length: n }, () => {
        const id = nextId.current++;
        ids.push(id);
        return { id, seriesId, state: "pending", lockedPrice: price, shares: 0, scratched: false };
      });
      setUsdc((u) => u - n * s.ticketUsd);
      setCards((c) => [...c, ...fresh]);
      setStats((st) => ({ ...st, sold: st.sold + n }));
      // each VRF reveal lands after its own delay
      fresh.forEach(async (card) => {
        await sleep(700 + Math.random() * 1400);
        const seed = crypto.getRandomValues(new Uint8Array(32));
        const art = cardArt(seed, s.tiers);
        const shares = art.multiplier > 0 ? Number(sharesFor(art.multiplier, BigInt(s.ticketUsd * 1e6), BigInt(Math.round(price * 1e8)))) / 1e6 : 0;
        setCards((cs) => cs.map((x) => (x.id === card.id ? { ...x, state: "revealed", seed, art, shares } : x)));
        setStats((st) => {
          const tc = [...st.tierCounts];
          tc[tierFor(seed, s.tiers)]++;
          return { ...st, tierCounts: tc };
        });
      });
      return ids;
    },
    [usdc, marketClosed],
  );

  const markScratched = useCallback((id: number) => setCards((cs) => cs.map((c) => (c.id === id ? { ...c, scratched: true } : c))), []);

  const claimAll = useCallback(async () => {
    const claimable = cards.filter((c) => c.state === "revealed");
    if (!claimable.length) return;
    setCards((cs) => cs.map((c) => (c.state === "revealed" ? { ...c, state: "claiming" } : c)));
    await sleep(1600); // commit + Magic Action → pay_out on base layer
    setHoldings((hs) => {
      const next = [...hs];
      for (const c of claimable) {
        if (!c.shares) continue;
        const s = seriesById(c.seriesId);
        const h = next.find((x) => x.ticker === s.ticker);
        if (h) {
          h.shares += c.shares;
          h.costUsd += c.shares * c.lockedPrice;
        } else next.push({ ticker: s.ticker, feed: s.feed, shares: c.shares, costUsd: c.shares * c.lockedPrice });
      }
      return next.map((h) => ({ ...h }));
    });
    setStats((st) => ({ ...st, paidShares: st.paidShares + claimable.reduce((a, c) => a + c.shares, 0) }));
    const done = new Set(claimable.map((c) => c.id));
    setCards((cs) => cs.map((c) => (done.has(c.id) ? { ...c, state: "settled" } : c)));
  }, [cards]);

  const faucet = useCallback(async () => {
    await sleep(500);
    setUsdc((u) => u + 50);
  }, []);

  const sell = useCallback((ticker: string, shares: number) => {
    setHoldings((hs) =>
      hs
        .map((h) => {
          if (h.ticker !== ticker) return h;
          const s = Math.min(shares, h.shares);
          setUsdc((u) => u + s * pricesRef.current[h.feed]);
          const frac = s / h.shares;
          return { ...h, shares: h.shares - s, costUsd: h.costUsd * (1 - frac) };
        })
        .filter((h) => h.shares > 1e-9),
    );
  }, []);

  const value = useMemo<Game>(
    () => ({ backend: "mock", usdc, prices, history, marketClosed, setMarketClosed, degraded: false, cards, holdings, buy, markScratched, claimAll, faucet, sell, stats }),
    [usdc, prices, history, marketClosed, cards, holdings, buy, markScratched, claimAll, faucet, sell, stats],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { SERIES };
