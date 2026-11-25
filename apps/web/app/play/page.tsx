"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { easing, timing, tierByMultiplier } from "@scratchers/ui-tokens";
import { useGame, isPaused } from "@scratchers/app-core";
import { seriesById } from "@scratchers/app-core";
import { SeriesPicker } from "@/components/SeriesPicker";
import { ScratchCard } from "@/components/ScratchCard";
import { JackpotOverlay } from "@/components/JackpotOverlay";
import { CountUp } from "@/components/CountUp";

export default function Play() {
  const g = useGame();
  const [sid, setSid] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jackpot, setJackpot] = useState<number | null>(null);
  const s = seriesById(sid);
  const paused = isPaused(g, s.feed);
  const live = g.cards.filter((c) => c.state !== "settled");
  const claimable = g.cards.filter((c) => c.state === "revealed");
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

  return (
    <div className="space-y-8">
      {g.setup && g.setup.status !== "ready" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4">
          <div className="flex-1 text-sm">
            <div className="font-semibold text-gold">Set up your account</div>
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
          Buy 1 · ${s.ticketUsd}
        </button>
        <button disabled={busy || paused} onClick={() => run(() => g.buy(sid, 10))} className="rounded-xl bg-gold px-5 py-3 font-bold text-ink disabled:opacity-40">
          Buy 10 · ${s.ticketUsd * 10}
        </button>
        <button onClick={() => run(g.faucet)} className="rounded-xl border border-line px-4 py-3 text-sm hover:bg-surface-hi">
          Get test funds (+100 mUSDC)
        </button>
        {paused && <span className="text-sm text-warn">Price paused: waiting for a fresh price.</span>}
        {err && <span className="text-sm text-danger">{err}</span>}
      </div>

      {live.length === 0 && <p className="text-dim">No cards yet. Grab test funds, then buy a pack.</p>}

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
              <div className="mb-2 flex w-full max-w-[300px] items-center justify-between text-xs text-dim">
                <span>#{c.id} · {seriesById(c.seriesId).ticker}</span>
                {c.state === "claiming" && <span className="text-warn">settling…</span>}
              </div>
              {c.state === "pending" || !c.art ? (
                <div className="shimmer aspect-square w-full max-w-[300px] rounded-2xl" aria-label="Randomness pending" />
              ) : (
                <>
                  <ScratchCard
                    art={c.art}
                    scratched={c.scratched}
                    disabled={c.state === "claiming"}
                    onDone={() => {
                      g.markScratched(c.id);
                      if (c.art!.multiplier >= 1000) setJackpot(c.shares * c.lockedPrice);
                    }}
                  />
                  {c.scratched && (
                    <div className="mt-3 text-center">
                      {c.art.win ? (
                        <>
                          <div className="font-bold" style={{ color: tierByMultiplier(c.art.multiplier).color }}>
                            {tierByMultiplier(c.art.multiplier).label}
                          </div>
                          <div className="text-sm text-dim">
                            <CountUp to={c.shares} prefix="" decimals={4} /> {seriesById(c.seriesId).ticker} ≈ <CountUp to={c.shares * g.prices[seriesById(c.seriesId).feed]} />
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-dim">No win. Try again.</div>
                      )}
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
            <div className="text-sm text-dim">{claimable.length} card{claimable.length > 1 ? "s" : ""} ready</div>
            <div className="text-lg font-bold text-money">≈ ${winUsd.toFixed(2)} in stock</div>
          </div>
          <button onClick={() => run(g.claimAll)} disabled={busy} className="rounded-xl bg-money px-5 py-3 font-bold text-ink disabled:opacity-40">
            Claim all
          </button>
        </div>
      )}

      <JackpotOverlay open={jackpot !== null} usd={jackpot ?? 0} onClose={() => setJackpot(null)} />
    </div>
  );
}
