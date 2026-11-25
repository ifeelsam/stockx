"use client";
import { useState } from "react";
import { multiplierOf, rtp, totalWeight } from "@scratchers/sdk";
import { tierByIndex } from "@scratchers/ui-tokens";
import { SERIES, TIER_NAMES, VISIBLE_SERIES } from "@scratchers/app-core";

export default function Prizes() {
  const [sid, setSid] = useState(11);
  const s = SERIES.find((x) => x.id === sid)!;
  const total = totalWeight(s.tiers);
  const r = rtp(s.tiers);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Rarity table</h1>
        <p className="mt-1 text-dim">Frozen on chain before packs open. Result = u64(seed[0..8]) mod {total.toLocaleString()} → rarity band.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {VISIBLE_SERIES.map((x) => (
          <button key={x.id} onClick={() => setSid(x.id)} className={`rounded-lg border px-3 py-1.5 text-sm ${x.id === sid ? "border-accent text-accent" : "border-line text-dim"}`}>
            {x.name}{x.demo ? " · DEMO" : ""}
          </button>
        ))}
      </div>
      {s.demo && (
        <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
          DEMO ODDS: Grail is about 1 in 20 and the RTP is boosted. Never shown as the public table.
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-dim">
            <tr>
              <th className="p-3">Rarity</th><th className="p-3">Payout</th><th className="p-3">Odds</th><th className="hidden p-3 text-right sm:table-cell">Weight</th><th className="p-3 text-right">RTP</th>
            </tr>
          </thead>
          <tbody>
            {s.tiers.map((t, i) => {
              const style = tierByIndex(i);
              const dust = t.multiplierBps < 10_000;
              return (
                <tr key={i} className="border-t border-line">
                  <td className="p-3 font-semibold" style={{ color: dust ? "#9A93AE" : style.color }}>{TIER_NAMES[i]}</td>
                  <td className="num p-3">{multiplierOf(t).toLocaleString(undefined, { maximumFractionDigits: 2 })}×{dust ? <span className="text-dim"> · 20¢ back</span> : null}</td>
                  <td className="num p-3">1 in {(total / t.weight).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="num hidden p-3 text-right sm:table-cell">{t.weight.toLocaleString()}</td>
                  <td className="num p-3 text-right">{((t.multiplierBps * t.weight) / total / 100).toFixed(3)}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-line bg-surface">
            <tr><td className="p-3 font-bold" colSpan={3}>Total</td><td className="num hidden p-3 text-right sm:table-cell">{total.toLocaleString()}</td><td className="num p-3 text-right font-bold text-money">{(r * 100).toFixed(3)}%</td></tr>
          </tfoot>
        </table>
      </div>
      <div className="grid gap-3 text-xs text-dim sm:grid-cols-3">
        <p><span className="text-text">75.371% returned</span> to players, a 24.629% house edge that covers VRF fees, commits, Magic Actions and price movement.</p>
        <p>Every rarity pays <span className="num">multiplier_bps × ticket ÷ 10,000 ÷ locked price</span> in tokenized shares, floored to 6 decimals.</p>
        <p><span className="text-text">Dust is 20¢ back, not a win.</span> Celebration starts at Uncommon (2×), where the player is actually ahead.</p>
      </div>
    </div>
  );
}
