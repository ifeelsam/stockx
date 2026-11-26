"use client";
/**
 * Chain backend for `useGame()`: same shape as the mock, driven by the SDK against devnet.
 * Wallet (Privy / Seeker) signs Solana-layer + one-time rollup txs; the session key signs everything else.
 *
 * The on-chain rules it relies on are checked live by scripts/src/conformance.ts; this React flow itself
 * has not been run end to end with a real login.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  buyCardIx, CardState, claimAllIx, waitForRollupUsdc, connect, createSessionIx, createStockAtaIx, delegatePlayerIx, depositToRollupIxs, depositUsdcIx,
  ACTION_ESCROW_LAMPORTS, PLAYER_RESERVE_LOW_LAMPORTS, topUpPlayerReserveIx, fetchDegraded, fetchPlayer, fetchStats, getProgram, maxPriceE8, playerPda, sell as sdkSell, signAndSend, signupIx, topUpActionEscrowIx,
  type Signer, type SessionKeySigner,
} from "@scratchers/sdk";
import { cardArt } from "@scratchers/sdk/pure";
import { GameCtx, type Game, type Holding, type Prices, type UiCard } from "./game.js";
import { seriesById, VISIBLE_SERIES } from "./series.js";

export type Deployments = {
  program: string;
  validator: string;
  mints: Record<string, string>;
  feeds: Record<string, { id: string; pda: string }>;
  series: { id: number; stock: string; demo: boolean; pda: string; vault: string }[];
};
export type ChainDeps = { signer: Signer; sessionKey: SessionKeySigner; deployments: Deployments; keeperUrl: string; baseUrl?: string };

const DLP = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const FEEDS = ["TSLA", "NVDA", "SOL"] as const;
const STOCKS = ["mTSLA", "mNVDA", "mSOL"] as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const EMPTY_PRICES: Prices = { TSLA: 0, NVDA: 0, SOL: 0 };

export function ChainGameProvider({ deps, children }: { deps: ChainDeps; children: ReactNode }) {
  const { signer, sessionKey, deployments: dep, keeperUrl } = deps;
  const c = useMemo(() => connect({ baseUrl: deps.baseUrl }), [deps.baseUrl]);
  const base = useMemo(() => getProgram(c.base), [c]);
  const rollup = useMemo(() => getProgram(c.rollup), [c]);
  const user = signer.publicKey;
  const usdcMint = useMemo(() => new PublicKey(dep.mints.mUSDC), [dep]);
  const validator = useMemo(() => new PublicKey(dep.validator), [dep]);

  const [prices, setPrices] = useState<Prices>(EMPTY_PRICES);
  const [history, setHistory] = useState<Game["history"]>({ TSLA: [], NVDA: [], SOL: [] });
  const [paused, setPaused] = useState<NonNullable<Game["paused"]>>({});
  const [degraded, setDegraded] = useState<string[]>([]);
  const [usdc, setUsdc] = useState(0);
  const [rawCards, setRawCards] = useState<Awaited<ReturnType<typeof fetchPlayer>>["cards"]>([]);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [stats, setStats] = useState<Game["stats"]>({ sold: 0, tierCounts: Array(8).fill(0), paidShares: 0 });
  const [setup, setSetup] = useState<NonNullable<Game["setup"]>["status"]>("checking");
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const claimed = useRef(new Set<number>());
  const cost = useRef(new Map<string, number>()); // ticker → USD cost basis from this session's claims

  // ---- polling: prices, status page, player cards, holdings, stats ------------------------------
  useEffect(() => {
    let stop = false;
    const loop = async (fn: () => Promise<void>, ms: number) => {
      while (!stop) {
        await fn().catch(() => {});
        await sleep(ms);
      }
    };
    loop(async () => {
      const next = { ...EMPTY_PRICES };
      const stale: NonNullable<Game["paused"]> = {};
      const now = Math.floor(Date.now() / 1000);
      for (const f of FEEDS) {
        const info = await c.rollup.getAccountInfo(new PublicKey(dep.feeds["m" + f].pda), "confirmed");
        if (!info) continue;
        const feed = base.coder.accounts.decode("priceFeed", info.data);
        next[f] = Number(feed.price.toString()) / 1e8;
        stale[f] = now - feed.publishTs.toNumber() > 60; // each series pauses on its own feed's staleness
      }
      setPrices(next);
      setPaused(stale);
      setHistory((h) => {
        const n = { ...h };
        for (const f of FEEDS) if (next[f]) n[f] = [...h[f].slice(-299), { t: now, v: next[f] }];
        return n;
      });
    }, 1000);
    loop(async () => setDegraded(await fetchDegraded("devnet", "asia")), 30_000);
    loop(async () => {
      const p = await fetchPlayer(rollup, user);
      setUsdc(Number(p.usdcBalanceE6.toString()) / 1e6);
      setRawCards(p.cards.filter((k) => k.state !== CardState.Empty));
    }, 800);
    loop(async () => {
      const hs: Holding[] = [];
      for (const s of STOCKS) {
        const bal = await c.base.getTokenAccountBalance(getAssociatedTokenAddressSync(new PublicKey(dep.mints[s]), user), "confirmed").catch(() => null);
        const shares = Number(bal?.value.amount ?? 0) / 1e6;
        if (shares > 0) {
          const feed = s.slice(1) as Holding["feed"];
          hs.push({ ticker: s, feed, shares, costUsd: cost.current.get(s) ?? shares * (prices[feed] || 0) });
        }
      }
      setHoldings(hs);
    }, 5000);
    loop(async () => {
      const agg: Game["stats"] = { sold: 0, tierCounts: Array(8).fill(0), paidShares: 0 };
      for (const s of dep.series) {
        const st = await fetchStats(rollup, s.id).catch(() => null);
        if (!st) continue;
        agg.sold += Number(st.cardsSold.toString());
        st.tierCounts.forEach((n: { toString(): string }, i: number) => (agg.tierCounts[i] += Number(n.toString())));
        agg.paidShares += Number(st.sharesWon.toString()) / 1e6;
      }
      setStats(agg);
    }, 10_000);
    return () => {
      stop = true;
    };
  }, [c, base, rollup, dep, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- cards: map chain state to UI state ---------------------------------------------------------
  const cards = useMemo<UiCard[]>(
    () =>
      rawCards
        // Settled slots stay visible (binder, proof) until a later buy reuses them.
        .filter((k) => k.state !== CardState.Cancelled)
        // cards of retired series (1-4) cannot be claimed: never show them under another series' table
        .filter((k) => dep.series.some((x) => x.id === k.series))
        .map((k) => {
          const id = Number(k.id.toString());
          const settled = k.state === CardState.Settled;
          const revealed = settled || k.state === CardState.Revealed || k.state === CardState.ClaimRequested;
          const seed = revealed ? Uint8Array.from(k.seed) : undefined;
          const s = seriesById(k.series);
          return {
            id,
            seriesId: k.series,
            state: settled ? "settled" : revealed ? (k.state === CardState.ClaimRequested ? "claiming" : "revealed") : "pending",
            seed,
            art: seed ? cardArt(seed, s.tiers) : undefined,
            lockedPrice: Number(k.lockedPrice.toString()) / 1e8,
            shares: revealed ? Number(k.shares.toString()) / 1e6 : 0,
            flipped: settled || flipped.has(id),
          } satisfies UiCard;
        }),
    [rawCards, flipped, dep],
  );

  // ---- onboarding -------------------------------------------------------------------------------------
  /** `minCapE6`: spend allowance the session must still have (default: one full pack). */
  const check = useCallback(async (minCapE6 = 10_000_000) => {
    const acc = await c.base.getAccountInfo(playerPda(user), "confirmed");
    if (!acc) return { status: "needed" as const, step: "signup" };
    if (!acc.owner.equals(DLP)) return { status: "needed" as const, step: "delegate" };
    const p = await fetchPlayer(rollup, user).catch(() => null);
    const ok = p && p.sessionKey.equals(sessionKey.publicKey) && p.sessionExpiry.toNumber() > Date.now() / 1000 + 120 && p.sessionSpendRemainingE6.toNumber() >= minCapE6;
    return ok ? { status: "ready" as const, step: "" } : { status: "needed" as const, step: "session" };
  }, [c, rollup, user, sessionKey]);
  useEffect(() => {
    check().then((r) => (setSetup(r.status), setStep(r.step)), (e) => setError(String(e)));
  }, [check]);

  const baseUsdc = useCallback(async () => BigInt((await c.base.getTokenAccountBalance(getAssociatedTokenAddressSync(usdcMint, user), "confirmed").catch(() => null))?.value.amount ?? "0"), [c, usdcMint, user]);

  /** Move all base USDC onto the rollup and credit the in-app balance (wallet signs a base tx, then a rollup tx).
   *  Also credits USDC an interrupted earlier deposit left in the rollup token account. */
  const deposit = useCallback(async () => {
    const amount = await baseUsdc();
    if (amount > 0n) await signAndSend(c.base, signer, new Transaction().add(...(await depositToRollupIxs(c.base, user, usdcMint, amount, validator, user))));
    const onRollup = await waitForRollupUsdc(c.rollup, user, usdcMint, amount);
    if (onRollup === 0n) return;
    await signAndSend(c.rollup, signer, new Transaction().add(await depositUsdcIx(rollup, user, usdcMint, onRollup)), { skipPreflight: true });
  }, [baseUsdc, c, signer, user, usdcMint, validator, rollup]);

  /** A fresh wallet has no SOL for rent/fees: ask the keeper faucet (SOL + mUSDC) before the first transaction. */
  const ensureFunds = useCallback(async () => {
    // new account: needs SOL for rent/fees and its starting 100 mUSDC (nothing in the wallet or on the rollup yet)
    const needsSol = (await c.base.getBalance(user, "confirmed")) < 100_000_000;
    const needsUsdc = (await baseUsdc()) === 0n && (await c.rollup.getAccountInfo(playerPda(user)).catch(() => null)) === null;
    if (!needsSol && !needsUsdc) return;
    setStep("funding");
    const r = await fetch(`${keeperUrl}/faucet`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: user.toBase58() }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({ error: r.statusText }))).error ?? "faucet failed");
    for (let i = 0; i < 20 && (await c.base.getBalance(user, "confirmed")) < 100_000_000; i++) await sleep(1000);
  }, [c, user, keeperUrl, baseUsdc]);

  const run = useCallback(async () => {
    setError(null);
    try {
      await ensureFunds();
      let r = await check();
      if (r.step === "signup" || r.step === "delegate") {
        setStep(r.step);
        const tx = new Transaction();
        if (r.step === "signup") {
          tx.add(await signupIx(base, user));
          for (const s of STOCKS) tx.add(createStockAtaIx(user, user, new PublicKey(dep.mints[s])));
        }
        tx.add(await delegatePlayerIx(base, user, validator), topUpActionEscrowIx(user, playerPda(user), ACTION_ESCROW_LAMPORTS));
        await signAndSend(c.base, signer, tx);
        for (let i = 0; i < 30 && !(await c.rollup.getAccountInfo(playerPda(user))); i++) await sleep(1000);
        r = await check();
      }
      if (r.step === "session") {
        setStep("session");
        const exp = Math.floor(Date.now() / 1000) + 24 * 3600;
        const tx = new Transaction().add(await createSessionIx(rollup, user, sessionKey.publicKey, exp, 100_000_000n));
        await signAndSend(c.rollup, signer, tx, { skipPreflight: true });
      }
      await deposit();
      const done = await check();
      setSetup(done.status);
      setStep(done.step);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [ensureFunds, check, base, rollup, c, signer, user, validator, dep, sessionKey, deposit]);

  // ---- game actions -------------------------------------------------------------------------------------
  /** An expired or used-up session sends the player back to the set-up card for one new approval. */
  const requireSession = useCallback(async (minCapE6: number) => {
    const r = await check(minCapE6);
    if (r.status === "ready") return;
    setSetup(r.status);
    setStep(r.step);
    throw new Error("Your play session ended or its spend limit is used up. Set up again to continue.");
  }, [check]);

  const buy = useCallback(
    async (seriesId: number, n: number) => {
      const s = seriesById(seriesId);
      const sd = dep.series.find((x) => x.id === seriesId);
      if (!sd) throw new Error("series not deployed");
      const price = prices[s.feed];
      if (!price) throw new Error("price unavailable");
      if (paused[s.feed]) throw new Error("Price paused: no fresh price for this series");
      await requireSession(n * s.ticketUsd * 1e6);
      const tx = new Transaction().add(
        await buyCardIx(rollup, {
          signer: sessionKey.publicKey,
          authority: user,
          seriesId,
          stockMint: new PublicKey(dep.mints[sd.stock]),
          feed: new PublicKey(dep.feeds[sd.stock].pda),
          n,
          maxPrice: maxPriceE8(price, 200),
          callerSeed: crypto.getRandomValues(new Uint8Array(32)),
        }),
      );
      await signAndSend(c.rollup, sessionKey, tx);
      return [];
    },
    [dep, prices, paused, rollup, sessionKey, user, c, requireSession],
  );

  /** Long sessions spend the Player's commit-fee reserve: refill it (one wallet-signed base tx) before it blocks claims. */
  const ensureCommitReserve = useCallback(async () => {
    const info = await c.rollup.getAccountInfo(playerPda(user), "confirmed");
    if (!info) return;
    const spare = async () => (await c.rollup.getBalance(playerPda(user), "confirmed")) - (await c.base.getMinimumBalanceForRentExemption(info.data.length));
    const before = await spare();
    if (before >= PLAYER_RESERVE_LOW_LAMPORTS) return;
    await signAndSend(c.base, signer, new Transaction().add(topUpPlayerReserveIx(user, user)));
    for (let i = 0; i < 30 && (await spare()) <= before; i++) await sleep(1000);
  }, [c, signer, user]);

  const claimAll = useCallback(async () => {
    await requireSession(0);
    await ensureCommitReserve();
    const bySeries = new Map<number, UiCard[]>();
    for (const k of cards.filter((x) => x.state === "revealed")) bySeries.set(k.seriesId, [...(bySeries.get(k.seriesId) ?? []), k]);
    for (const [seriesId, list] of bySeries) {
      const sd = dep.series.find((x) => x.id === seriesId)!;
      for (let i = 0; i < list.length; i += 8) {
        const tx = new Transaction().add(await claimAllIx(rollup, sessionKey.publicKey, user, seriesId, new PublicKey(dep.mints[sd.stock]), validator));
        await signAndSend(c.rollup, sessionKey, tx);
        for (const k of list.slice(i, i + 8)) {
          claimed.current.add(k.id);
          if (k.shares) cost.current.set(sd.stock, (cost.current.get(sd.stock) ?? 0) + k.shares * k.lockedPrice);
        }
      }
    }
  }, [cards, dep, rollup, sessionKey, user, validator, c, ensureCommitReserve, requireSession]);

  const faucet = useCallback(async () => {
    if (setup !== "ready") throw new Error("Set up your account first (the Set up card above).");
    const r = await fetch(`${keeperUrl}/faucet`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: user.toBase58() }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({ error: r.statusText }))).error ?? "faucet failed");
    await sleep(1500);
    await deposit();
  }, [keeperUrl, user, deposit, setup]);

  const sell = useCallback(
    (ticker: string, shares: number) => {
      const sd = dep.series.find((x) => x.stock === ticker);
      if (!sd) return;
      sdkSell({ program: base, base: c.base, signer, network: "devnet", stockMint: new PublicKey(dep.mints[ticker]), usdcMint, shares: BigInt(Math.floor(shares * 1e6)) }).catch((e) => setError(String(e)));
    },
    [dep, base, c, signer, usdcMint],
  );

  const value = useMemo<Game>(
    () => ({
      backend: "chain",
      usdc,
      prices,
      history,
      marketClosed: VISIBLE_SERIES.some((x) => paused[x.feed]), // banner: any offered series is paused
      setMarketClosed: () => {},
      paused,
      degraded,
      cards,
      holdings,
      buy,
      markFlipped: (id) => setFlipped((s) => new Set(s).add(id)),
      claimAll,
      faucet,
      sell,
      setup: { status: setup, step, error, run },
      stats,
    }),
    [usdc, prices, history, paused, degraded, cards, holdings, buy, claimAll, faucet, sell, setup, step, error, run, stats],
  );
  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}
