"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { TIERS } from "@scratchers/ui-tokens";
import { Symbol } from "@/components/Symbol";

const HERO = ["rocket", "rocket", "leaf", "gem", "rocket", "moon", "key", "fish", "cloud"];

export default function Landing() {
  return (
    <div className="grid items-center gap-12 py-8 lg:grid-cols-2">
      <div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">Entertainment × Finance</p>
        <h1 className="text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          Scratch a $1 card.
          <br />
          <span className="text-money">Win real stock.</span>
        </h1>
        <p className="mt-5 max-w-md text-lg text-dim">
          From money back to a 1,000× jackpot, paid in tokenized shares. Every result is set by on-chain VRF against a public prize table. Anyone can recompute it.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/play" className="rounded-xl bg-money px-6 py-3.5 font-bold text-ink hover:brightness-110">
            Play now
          </Link>
          <Link href="/prizes" className="rounded-xl border border-line px-6 py-3.5 font-semibold hover:bg-surface-hi">
            See the odds
          </Link>
        </div>
        <ul className="mt-10 grid max-w-md grid-cols-3 gap-4 text-sm">
          {[["76%", "RTP, public"], ["1 in 2.6", "cards win"], ["0 fees", "gasless plays"]].map(([a, b]) => (
            <li key={a}>
              <div className="num text-xl font-bold">{a}</div>
              <div className="text-dim">{b}</div>
            </li>
          ))}
        </ul>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, rotate: -6 }}
        animate={{ opacity: 1, y: 0, rotate: -3 }}
        whileHover={{ rotate: 0, scale: 1.02 }}
        transition={{ type: "spring", stiffness: 120, damping: 14 }}
        className="mx-auto w-full max-w-sm rounded-3xl border border-line bg-surface p-5"
        style={{ boxShadow: `0 0 80px ${TIERS.x100.glow}22` }}
      >
        <div className="mb-3 flex justify-between text-xs text-dim">
          <span>mTSLA · $1</span>
          <span className="text-gold">100× WIN</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {HERO.map((s, i) => {
            const win = s === "rocket";
            return (
              <div key={i} className="flex aspect-square items-center justify-center rounded-xl bg-surface-hi" style={win ? { outline: `1.5px solid ${TIERS.x100.color}`, background: `${TIERS.x100.color}1f` } : undefined}>
                <Symbol name={s} size={44} color={win ? TIERS.x100.color : "#8B93A7"} glow={win} />
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-center">
          <div className="text-sm text-dim">paid out</div>
          <div className="num text-2xl font-bold text-money">0.4027 mTSLA</div>
        </div>
      </motion.div>
    </div>
  );
}
