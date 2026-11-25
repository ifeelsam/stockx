"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { TIERS, TIER_KEYS } from "@scratchers/ui-tokens";
import { Symbol } from "@/components/Symbol";

const HERO = ["dice", "bull", "leaf", "wave", "bull", "moon", "key", "bull", "cloud"];

export default function Landing() {
  return (
    <div className="space-y-16 py-8">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-accent">Entertainment × Finance</p>
          <h1 className="text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
            Rip a pack.
            <br />
            <span className="text-money">Keep the stock.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-dim">
            A $1 holo pack pays <span className="text-text">tokenized stock</span>: from 20¢ of Dust to a 1,000× Grail. Every result is set by on-chain VRF against a frozen public table. Anyone can recompute it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/play" className="rounded-xl bg-money px-6 py-3.5 font-bold text-ink hover:brightness-110">
              Rip a pack
            </Link>
            <Link href="/prizes" className="rounded-xl border border-line px-6 py-3.5 font-semibold hover:bg-surface-hi">
              See the odds
            </Link>
          </div>
          <ul className="mt-10 grid max-w-md grid-cols-3 gap-4 text-sm">
            {[["75.37%", "RTP, public"], ["24%", "pay ≥ $1"], ["0 fees", "gasless plays"]].map(([a, b]) => (
              <li key={a}>
                <div className="num text-xl font-bold">{a}</div>
                <div className="text-dim">{b}</div>
              </li>
            ))}
          </ul>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30, rotate: -5 }}
          animate={{ opacity: 1, y: 0, rotate: -2 }}
          whileHover={{ rotate: 0, scale: 1.015 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="relative mx-auto w-full max-w-[360px]"
        >
          <div className="card-stock relative overflow-hidden rounded-[28px] border-[3px] p-5 shadow-[0_30px_100px_rgba(247,212,92,0.18)]" style={{ borderColor: TIERS.grail.color }}>
            <span className="holo-sheen" style={{ opacity: 0.55 }} />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] opacity-55">Stock Scratchers</div>
                <div className="mt-1 text-3xl font-extrabold leading-none tracking-tight" style={{ color: TIERS.grail.color }}>Grail</div>
              </div>
              <div className="num text-right text-[10px] uppercase leading-tight opacity-60">mTSLA<br />1,000×</div>
            </div>
            <div className="relative mt-5 grid grid-cols-3 gap-2">
              {HERO.map((s, i) => {
                const hit = s === "bull";
                return (
                  <div key={i} className="flex aspect-square items-center justify-center rounded-xl border" style={hit ? { outline: `1.5px solid ${TIERS.grail.color}`, borderColor: "transparent", background: `${TIERS.grail.color}22` } : { borderColor: "rgba(23,19,32,0.10)", background: "rgba(23,19,32,0.045)" }}>
                    <Symbol name={s} size={44} color={hit ? TIERS.grail.color : "#6E687A"} glow={hit} />
                  </div>
                );
              })}
            </div>
            <div className="relative mt-5 flex items-end justify-between border-t border-black/10 pt-3">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-45">You keep</div>
                <div className="num text-lg font-bold" style={{ color: TIERS.grail.color }}>2.4248 mTSLA</div>
              </div>
              <div className="num text-[10px] tracking-[0.18em] opacity-45">$1,000.00</div>
            </div>
          </div>
        </motion.div>
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Eight rarities. No blanks.</h2>
            <p className="text-sm text-dim">Every pack holds stock. Dust returns 20¢; it is not a win, and we never dress it up as one.</p>
          </div>
          <Link href="/prizes" className="hidden text-sm text-accent hover:underline sm:block">Full table →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {TIER_KEYS.map((k) => {
            const t = TIERS[k];
            const dust = k === "dust";
            return (
              <div key={k} className="rounded-2xl border border-line bg-surface p-3" style={{ borderColor: dust ? undefined : `${t.color}55` }}>
                <Symbol name={t.symbol} size={26} color={dust ? "#8B8798" : t.color} />
                <div className="mt-2 text-sm font-bold" style={{ color: dust ? "#9A93AE" : t.color }}>{t.label}</div>
                <div className="num text-xs text-dim">{t.payout}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
