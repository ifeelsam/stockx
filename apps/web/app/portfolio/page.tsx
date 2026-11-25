"use client";
import { useState } from "react";
import { TIERS, TIER_KEYS, type TierKey } from "@scratchers/ui-tokens";
import { seriesById, useGame, VISIBLE_SERIES, type UiCard } from "@scratchers/app-core";
import { Gem, HoloCard, type Feed } from "@/components/HoloCard";
import { Sparkline } from "@/components/Sparkline";
import { cardView, change, money } from "@/lib/cards";

type Shown = UiCard & { art: NonNullable<UiCard["art"]> };

/** Binder: the cards you pulled, by stock and rarity, plus the shares they paid into your wallet. */
export default function Binder() {
  const g = useGame();
  const [set, setSet] = useState<Feed>("TSLA");
  const [sel, setSel] = useState<TierKey | null>(null);
  const feeds = [...new Set<Feed>([...VISIBLE_SERIES.map((s) => s.feed), ...g.holdings.map((h) => h.feed)])];
  const total = g.holdings.reduce((a, h) => a + h.shares * g.prices[h.feed], 0);
  const cost = g.holdings.reduce((a, h) => a + h.costUsd, 0);

  // ponytail: history = the card slots still on the Player account (32, reused by later buys).
  // A full binder needs an indexer over CardRevealed events.
  const mine = g.cards.filter((c): c is Shown => !!c.art && (c.flipped || c.state === "settled"));
  const slotsFor = (feed: Feed) => {
    const best = new Map<TierKey, Shown[]>();
    for (const c of mine) {
      if (seriesById(c.seriesId).feed !== feed) continue;
      const k = cardView(c, g.prices).tier.key;
      best.set(k, [...(best.get(k) ?? []), c]);
    }
    return best;
  };
  const slots = slotsFor(set);
  const pick = sel && slots.has(sel) ? sel : [...TIER_KEYS].reverse().find((k) => slots.has(k));
  const card = pick ? slots.get(pick)!.at(-1)! : undefined;
  const view = card && cardView(card, g.prices);
  const holding = g.holdings.find((h) => h.feed === set);
  const since = card && view ? view.value - card.shares * card.lockedPrice : 0;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-5xl font-extrabold tracking-tight">Binder</h1>
        <span className="text-3xl font-extrabold tracking-tight">{money(total)}</span>
        {g.holdings.length > 0 && <span className={`text-[15px] font-bold ${change(total - cost).cls}`}>{change(total - cost).text} since pulled</span>}
      </div>

      <div className="mt-7 flex flex-wrap items-start gap-7">
        <nav aria-label="Sets" className="flex min-w-0 flex-[1_1_190px] flex-col gap-2">
          {feeds.map((f) => {
            const have = slotsFor(f).size;
            return (
              <button key={f} aria-pressed={f === set} onClick={() => { setSet(f); setSel(null); }} className={`flex min-h-16 flex-col gap-1.5 rounded-[14px] border px-3.5 py-2.5 text-left ${f === set ? "border-accent bg-surface" : "border-line"}`}>
                <span className="flex w-full justify-between font-extrabold">{f}<span className="num text-xs">{have}/8</span></span>
                <span className="block h-[5px] w-full rounded bg-line"><span className="block h-full rounded bg-accent" style={{ width: `${(have / 8) * 100}%` }} /></span>
              </button>
            );
          })}
        </nav>

        <section className="min-w-0 flex-[999_1_520px]">
          <h2 className="text-[22px] font-extrabold">{set} set · {slots.size} of 8 rarities</h2>
          <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-[18px]">
            {TIER_KEYS.map((k, i) => {
              const owned = slots.get(k);
              const v = owned && cardView(owned.at(-1)!, g.prices);
              const odds = seriesById(11).tiers[i];
              return (
                <li key={k} className="flex flex-col items-start gap-1.5">
                  {v ? (
                    <>
                      <button aria-pressed={k === pick} aria-label={`Show your ${TIERS[k].label} card`} onClick={() => setSel(k)} className="rounded-[10px]" style={{ boxShadow: k === pick ? "0 0 0 3px #F2EFFA" : "none" }}>
                        <HoloCard {...v.face} width={150} />
                      </button>
                      <span className="text-sm font-bold">{money(v.value)}{owned.length > 1 ? <span className="num text-xs text-dim"> ×{owned.length}</span> : null}</span>
                    </>
                  ) : (
                    <>
                      <div className="flex h-[214px] w-[150px] flex-col items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-[#3A3350]">
                        <Gem fill={TIERS[k].color} size={18} />
                        <span className="text-[15px] font-bold text-[#C9C2E6]">{TIERS[k].label}</span>
                      </div>
                      <span className="num text-[11px] text-dim">{k === "dust" ? "~76%" : `1 in ${Math.round(100_000 / odds.weight).toLocaleString("en-US")}`}</span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col items-center gap-3.5 rounded-[18px] border border-line p-5">
          {view ? (
            <>
              <HoloCard {...view.face} width={243} />
              <div className="flex w-full items-baseline justify-between">
                <span className="text-3xl font-extrabold tracking-tight">{money(view.value)}</span>
                <span className={`text-sm font-bold ${change(since).cls}`}>{change(since).text} since pulled</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-dim">Flip a card and it shows up here.</p>
          )}
          <div className="w-full"><Sparkline data={g.history[set]} height={90} /></div>
          {holding ? (
            <>
              <div className="num w-full text-xs text-[#C9C2E6]">In your wallet: {holding.shares.toFixed(6)} {holding.ticker} ≈ {money(holding.shares * g.prices[set])}</div>
              <button onClick={() => g.sell(holding.ticker, holding.shares)} className="btn-ghost w-full">Sell all {holding.ticker} for USDC</button>
            </>
          ) : (
            <p className="num w-full text-xs text-dim">No {set} shares in your wallet yet. Claim a pack to receive them.</p>
          )}
          <p className="text-xs text-dim">Devnet sells go to the vault at the keeper's quote, minus 0.5%.</p>
        </aside>
      </div>
    </div>
  );
}
