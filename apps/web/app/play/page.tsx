"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { easing, timing, TIERS, TIER_KEYS } from "@scratchers/ui-tokens";
import { isPaused, seriesById, useGame, VISIBLE_SERIES, type UiCard } from "@scratchers/app-core";
import { CardBack, Gem, HoloCard } from "@/components/HoloCard";
import { PackRip } from "@/components/PackRip";
import { JackpotOverlay } from "@/components/JackpotOverlay";
import { cardView, money } from "@/lib/cards";
import { revealFx } from "@/lib/fx";

const W = 172;
type Shown = UiCard & { art: NonNullable<UiCard["art"]> };

export default function Rip() {
  const g = useGame();
  const [sid, setSid] = useState(11);
  const [count, setCount] = useState<1 | 10>(10);
  const [another, setAnother] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [grail, setGrail] = useState<Shown | null>(null);

  // ?s=14&n=1 from the Packs page
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (VISIBLE_SERIES.some((x) => x.id === Number(q.get("s")))) setSid(Number(q.get("s")));
    if (q.get("n") === "1") setCount(1);
  }, []);

  const s = seriesById(sid);
  const paused = isPaused(g, s.feed);
  const live = g.cards.filter((c) => c.state !== "settled");
  const revealed = live.filter((c): c is Shown => !!c.art);
  const claimable = revealed.filter((c) => c.state === "revealed");
  const flipped = revealed.filter((c) => c.flipped);
  const faceDown = claimable.filter((c) => !c.flipped);
  const sealed = another || live.length === 0;
  const price = money(s.ticketUsd * count);

  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const flip = (cards: Shown[]) => {
    if (!cards.length) return;
    for (const c of cards) g.markFlipped(c.id);
    const best = cards.reduce((a, b) => (b.art.multiplierBps > a.art.multiplierBps ? b : a));
    revealFx(best.art.multiplier);
    if (best.art.multiplierBps >= 10_000_000) setGrail(best);
  };

  const views = flipped.map((c) => cardView(c, g.prices));
  const total = views.reduce((a, v) => a + v.usd, 0);
  const shares = new Map<string, number>();
  flipped.forEach((c, i) => shares.set(views[i].series.ticker, (shares.get(views[i].series.ticker) ?? 0) + c.shares));

  return (
    <div className="space-y-8">
      {g.setup && g.setup.status !== "ready" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <div className="flex-1 text-sm">
            <div className="font-bold text-accent">Set up your account</div>
            <div className="text-[#C9C2E6]">One time: create your player, delegate it to the rollup, start a play session{g.setup.step ? ` (next: ${g.setup.step})` : ""}.</div>
            {g.setup.error && <div className="mt-1 text-danger">{g.setup.error}</div>}
          </div>
          <button onClick={() => run(g.setup!.run)} disabled={busy || g.setup.status === "checking"} className="btn-primary">
            {busy ? "Working…" : "Set up"}
          </button>
        </div>
      )}
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}

      {sealed ? (
        <section className="flex flex-col items-center gap-8">
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Choose a pack">
            {VISIBLE_SERIES.map((x) => (
              <button key={x.id} aria-pressed={x.id === sid} onClick={() => setSid(x.id)} className="chip">
                {x.demo ? `${x.feed} · DEMO ODDS` : x.feed}
              </button>
            ))}
            <span className="mx-2 w-px bg-line" />
            {([10, 1] as const).map((n) => (
              <button key={n} aria-pressed={n === count} onClick={() => setCount(n)} className="chip">
                {n === 1 ? "1 card" : "10 cards"} · {money(s.ticketUsd * n)}
              </button>
            ))}
          </div>
          <PackRip
            feed={s.feed}
            count={count}
            demo={s.demo}
            paused={paused}
            busy={busy}
            price={price}
            onRip={() => run(() => g.buy(sid, count)).then((ok) => ok && setAnother(false))}
          />
          {live.length > 0 && (
            <button onClick={() => setAnother(false)} className="btn-ghost">
              Back to your {live.length} card{live.length > 1 ? "s" : ""}
            </button>
          )}
        </section>
      ) : (
        <div className="flex flex-wrap items-start gap-8">
          <section className="min-w-0 flex-[999_1_560px]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-4xl font-extrabold tracking-tight">{seriesById(live[0].seriesId).feed} pack</h1>
              <span className="num text-[13px] text-[#C9C2E6]">{revealed.length} of {live.length} drawn on-chain · tap a card to flip</span>
            </div>
            <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(172px,1fr))] gap-x-4 gap-y-6">
              <AnimatePresence>
                {live.map((c, i) => {
                  const v = c.art ? cardView(c as Shown, g.prices) : null;
                  const up = v && (c.flipped || c.state === "claiming");
                  return (
                    <motion.div
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: 60, rotate: (i % 5) * 6 - 12, scale: 0.7 }}
                      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: "spring", ...easing.spring, delay: (i % 10) * (timing.packStagger / 1000) }}
                      className="flex flex-col items-center gap-2"
                    >
                      {!v ? (
                        <div className="shim" aria-label={`Card ${c.id}: randomness pending`}>
                          <CardBack width={W} />
                        </div>
                      ) : up ? (
                        <div className="flipin">
                          <HoloCard {...v.face} width={W} />
                        </div>
                      ) : (
                        <button onClick={() => flip([c as Shown])} aria-label={`Flip card ${c.id}`} className="rounded-xl">
                          <CardBack rarity={v.tier.key} tease width={W} />
                        </button>
                      )}
                      <span className="num text-center text-[11px]" style={{ color: up ? v.tier.color : v ? "#9DF3FF" : "#A9A3BC" }}>
                        {c.state === "claiming" ? "settling…" : up ? `${v.caption.title} · ${v.caption.sub}` : v ? "ready" : "drawing…"}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </section>

          <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-4 rounded-[18px] border border-line p-5">
            <span className="text-sm font-bold text-[#C9C2E6]">This pack so far</span>
            <div>
              <div className="text-5xl font-extrabold tracking-tight">{money(total)}</div>
              <div className="num text-xs text-[#C9C2E6]">{[...shares].map(([t, n]) => `${n.toFixed(6)} ${t}`).join(" · ") || "flip a card"}</div>
            </div>
            <ul>
              {TIER_KEYS.map((k) => {
                const mine = views.filter((v) => v.tier.key === k);
                if (!mine.length) return null;
                return (
                  <li key={k} className="flex min-h-9 items-center gap-2.5 border-b border-line text-[15px] font-bold">
                    <Gem fill={TIERS[k].color} size={12} />
                    {TIERS[k].label}
                    <span className="num ml-auto text-xs font-normal">×{mine.length} · {money(mine.reduce((a, v) => a + v.usd, 0))}</span>
                  </li>
                );
              }).reverse()}
            </ul>
            <div>
              <div className="num flex justify-between text-xs text-[#C9C2E6]"><span>VRF draws</span><span>{revealed.length} / {live.length}</span></div>
              <div className="mt-1.5 h-1.5 rounded bg-line"><div className="h-full rounded bg-accent transition-[width]" style={{ width: `${(revealed.length / live.length) * 100}%` }} /></div>
            </div>
            <button onClick={() => flip(faceDown)} disabled={!faceDown.length} className="btn-ghost">Flip all ready</button>
            <button onClick={() => run(g.claimAll)} disabled={busy || !claimable.length} className="btn-primary">
              {busy ? "Working…" : "Claim all to binder"}
            </button>
            <button onClick={() => setAnother(true)} className="text-sm text-dim underline-offset-4 hover:underline">Rip another</button>
          </aside>
        </div>
      )}

      <JackpotOverlay
        card={grail}
        onClose={() => setGrail(null)}
        onClaim={() => {
          setGrail(null);
          run(g.claimAll);
        }}
      />
    </div>
  );
}
