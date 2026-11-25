"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { easing, timing, tierByMultiplier } from "@scratchers/ui-tokens";
import { useGame, isPaused } from "@scratchers/app-core";
import { seriesById } from "@scratchers/app-core";
import { SeriesPicker } from "@/components/SeriesPicker";
import { HoloCard } from "@/components/HoloCard";
import { JackpotOverlay } from "@/components/JackpotOverlay";
import { CountUp } from "@/components/CountUp";
import { revealFx } from "@/lib/fx";

export default function Play() {
  const g = useGame();
  const [sid, setSid] = useState(11);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jackpot, setJackpot] = useState<number | null>(null);
  const s = seriesById(sid);
  const paused = isPaused(g, s.feed);
  const live = g.cards.filter((c) => c.state !== "settled");
  const claimable = g.cards.filter((c) => c.state === "revealed");
  const faceDown = claimable.filter((c) => c.art && !c.flipped);
  const winUsd = claimable.reduce((a, c) => a + c.shares * g.prices[seriesById(c.seriesId).feed], 0);

  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const flipAll = () => {
    if (!faceDown.length) return;
    for (const c of faceDown) g.markFlipped(c.id);
    const best = [...faceDown].sort((a, b) => (b.art?.multiplierBps ?? 0) - (a.art?.multiplierBps ?? 0))[0];
    if (best?.art) {
      revealFx(best.art.multiplier);
      if (best.art.multiplierBps >= 10_000_000) setJackpot(best.shares * best.lockedPrice);
    }
  };

  return (
    <div className="space-y-8">
      {g.setup && g.setup.status !== "ready" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4">
          <div className="flex-1 text-sm">
            <div className="font-semibold text-gold">Set up your pack account</div>
            <div className="text-dim">One-time: create your player, delegate it to the rollup, start a play session{g.setup.step ? ` (next: ${g.setup.step})` : ""}.</div>
            {g.setup.error && <div className="mt-1 text-danger">{g.setup.error}</div>}
          </div>
          <button onClick={() => run(g.setup!.run)} disabled={busy || g.setup.status === "checking"} className="rounded-xl bg-gold px-5 py-2.5 font-bold text-ink disabled:opacity-40">
            {busy ? "Working…" : "Set up"}
          </button>
        </div>
      )}
      <SeriesPicker value={sid} onChange={setSid} />

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy || paused} onClick={() => run(() => g.buy(sid, 1))} className="rounded-xl bg-money px-5 py-3 font-bold text-ink disabled:opacity-40">
          Rip 1 pack · ${s.ticketUsd}
        </button>
        <button disabled={busy || paused} onClick={() => run(() => g.buy(sid, 10))} className="rounded-xl bg-gold px-5 py-3 font-bold text-ink disabled:opacity-40">
          Rip 10 · ${s.ticketUsd * 10}
        </button>
        <button onClick={() => run(g.faucet)} className="rounded-xl border border-line px-4 py-3 text-sm hover:bg-surface-hi">
          Get test funds (+100 mUSDC)
        </button>
        {paused && <span className="text-sm text-warn">Price paused: waiting for a fresh print.</span>}
        {err && <span className="text-sm text-danger">{err}</span>}
      </div>

      {live.length === 0 && <p className="text-dim">No packs yet. Grab test funds, then rip a pack. Every card holds stock, even Dust.</p>}

      {faceDown.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4">
          <div>
            <div className="font-bold text-accent">{faceDown.length} sealed card{faceDown.length > 1 ? "s" : ""}</div>
            <div className="text-sm text-dim">Tap a card to flip it. Dust cards stay plain; a glow means a real pull.</div>
          </div>
          <button onClick={flipAll} disabled={busy} className="rounded-xl border border-accent/50 px-4 py-2 text-sm font-bold text-accent hover:bg-accent/10 disabled:opacity-40">
            Flip all
          </button>
        </div>
      )}

      <motion.div layout className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {live.map((c, i) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 60, rotate: (i % 5) * 6 - 12, scale: 0.7 }}
              animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", ...easing.spring, delay: (i % 10) * (timing.packStagger / 1000) }}
              className="flex flex-col items-center"
            >
              <div className="mb-2 flex w-full max-w-[318px] items-center justify-between text-xs text-dim">
                <span>#{c.id} · {seriesById(c.seriesId).ticker}</span>
                {c.state === "claiming" && <span className="text-warn">settling…</span>}
              </div>
              {c.state === "pending" || !c.art ? (
                <div className="shimmer aspect-[300/420] w-full max-w-[318px] rounded-[26px]" aria-label="Randomness pending" />
              ) : (
                <>
                  <HoloCard
                    art={c.art}
                    flipped={c.flipped}
                    disabled={c.state === "claiming"}
                    cardId={c.id}
                    ticker={seriesById(c.seriesId).ticker}
                    onDone={() => {
                      g.markFlipped(c.id);
                      if (c.art!.multiplierBps >= 10_000_000) setJackpot(c.shares * c.lockedPrice);
                    }}
                  />
                  {c.flipped && (
                    <div className="mt-3 text-center">
                      <div className="font-bold" style={{ color: tierByMultiplier(c.art.multiplier).color }}>
                        {c.art.rarity} · {tierByMultiplier(c.art.multiplier).payout}
                      </div>
                      <div className="text-sm text-dim">
                        {c.art.multiplierBps < 10_000 ? "Dust · " : ""}
                        <CountUp to={c.shares} prefix="" decimals={4} /> {seriesById(c.seriesId).ticker} ≈ <CountUp to={c.shares * g.prices[seriesById(c.seriesId).feed]} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {claimable.length > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between rounded-2xl border border-line bg-surface/95 p-4 backdrop-blur">
          <div>
            <div className="text-sm text-dim">{claimable.length} card{claimable.length > 1 ? "s" : ""} holding stock</div>
            <div className="text-lg font-bold text-money">≈ ${winUsd.toFixed(2)}</div>
          </div>
          <button onClick={() => run(g.claimAll)} disabled={busy} className="rounded-xl bg-money px-5 py-3 font-bold text-ink disabled:opacity-40">
            Claim all stock
          </button>
        </div>
      )}

      <JackpotOverlay open={jackpot !== null} usd={jackpot ?? 0} onClose={() => setJackpot(null)} />
    </div>
  );
}
