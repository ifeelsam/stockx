"use client";
import { useState } from "react";
import Link from "next/link";
import { FINISH, STOCK_LOOK, TIERS, TIER_KEYS } from "@scratchers/ui-tokens";
import { isPaused, useGame, VISIBLE_SERIES } from "@scratchers/app-core";
import { multiplierOf, rtp, totalWeight, DEFAULT_TIERS } from "@scratchers/sdk";
import { HoloCard } from "@/components/HoloCard";
import { HoloPack } from "@/components/HoloPack";
import { cardUsd, money, oddsText } from "@/lib/cards";

/** Packs: choose a pack, see what is inside. */
export default function Packs() {
  const g = useGame();
  const [picked, setPicked] = useState(0);
  const cur = VISIBLE_SERIES[picked];
  const paused = isPaused(g, cur.feed);
  const total = totalWeight(cur.tiers);
  return (
    <div className="space-y-16 py-4">
      <section className="flex flex-wrap items-center gap-10">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
          <h1 className="text-6xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-7xl">
            Rip a pack.
            <br />
            Pull real stock.
          </h1>
          <p className="max-w-md text-lg text-[#C9C2E6]">Every card holds {cur.feed === "SOL" ? "SOL" : `tokenized ${STOCK_LOOK[cur.feed].company} stock`}. Its rarity sets how much: from 20¢ of Dust up to a 1,000× Grail. Devnet demo, mock tokens only.</p>
          <div className="flex flex-wrap gap-2.5">
            {paused ? (
              <span className="flex min-h-14 items-center rounded-[14px] border border-dashed border-accent px-6 font-extrabold text-accent">Price paused · waiting for a fresh price</span>
            ) : (
              <>
                <Link href={`/play?s=${cur.id}&n=10`} className="btn-primary min-h-14 px-7 text-lg">Rip {cur.feed} · {money(cur.ticketUsd * 10)}</Link>
                <Link href={`/play?s=${cur.id}&n=1`} className="btn-ghost min-h-14 px-5">1 card · {money(cur.ticketUsd)}</Link>
              </>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_480px] flex-col items-center gap-5 overflow-x-clip">
          {/* fixed-width row, scaled down on phones so both packs stay on screen */}
          <div className="flex h-[250px] w-[600px] shrink-0 origin-bottom scale-[0.62] items-end justify-center sm:h-[390px] sm:scale-100">
            {/* previous, picked, next: the rest wait off stage */}
            {[-1, 0, 1].map((rel) => {
              const i = (picked + rel + VISIBLE_SERIES.length) % VISIBLE_SERIES.length;
              const s = VISIBLE_SERIES[i];
              const on = rel === 0;
              return (
                <button
                  key={s.id}
                  aria-pressed={on}
                  aria-label={`Choose the ${s.name}`}
                  onClick={() => setPicked(i)}
                  className="-mx-[26px] origin-bottom transition-[transform,opacity] duration-300"
                  style={{ transform: `translateY(${on ? 0 : 18}px) rotate(${rel * -6}deg) scale(${on ? 1.12 : 0.86})`, opacity: on ? 1 : 0.6, zIndex: on ? 2 : 1, margin: on ? "0 6px" : undefined }}
                >
                  <div className={on ? "bob" : ""}>
                    <HoloPack feed={s.feed} demo={s.demo} paused={isPaused(g, s.feed)} offset={rel * 0.6} />
                  </div>
                </button>
              );
            })}
          </div>
          <div role="group" aria-label="Choose a pack" className="flex gap-2">
            {VISIBLE_SERIES.map((s, i) => (
              <button key={s.id} aria-pressed={i === picked} onClick={() => setPicked(i)} className="chip">
                {s.demo ? "DEMO ODDS" : s.feed}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-3xl font-extrabold tracking-tight">What's inside a {cur.feed} pack</h2>
          <span className="num text-xs text-dim">{cur.demo ? "DEMO ODDS · not the real table" : `most cards are Dust (20¢ back) · ${(rtp(DEFAULT_TIERS) * 100).toFixed(3)}% returned on average`}</span>
        </div>
        <ul className="flex gap-4 overflow-x-auto pb-2 pt-5">
          {TIER_KEYS.map((k, i) => {
            const mult = `${multiplierOf(cur.tiers[i]).toLocaleString("en-US")}×`;
            const odds = oddsText(cur.tiers[i].weight, total);
            return (
              <li key={k} className="flex flex-none flex-col gap-2">
                <HoloCard feed={cur.feed} rarity={k} mult={mult} usd={cardUsd(multiplierOf(cur.tiers[i]) * cur.ticketUsd)} shares={odds} serial="——" tilt={(0.15 + i * 0.12) % 1} width={160} />
                <span className="font-extrabold" style={{ color: FINISH[k] && TIERS[k].color }}>{TIERS[k].label} {mult}</span>
                <span className="num -mt-1.5 text-[11px] text-dim">{odds}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col items-start gap-3 rounded-[18px] border border-line p-6">
        <h2 className="text-2xl font-extrabold tracking-tight">Every pull is provable</h2>
        <p className="max-w-2xl text-[15px] leading-6 text-[#C9C2E6]">Each card's rarity comes from MagicBlock VRF against a table frozen on chain before the first pack sells. Flip any card to its back and redo the sum yourself: the seed, the roll, and the band it landed in.</p>
        <Link href="/verify" className="btn-ghost">Check a card →</Link>
      </section>
    </div>
  );
}
