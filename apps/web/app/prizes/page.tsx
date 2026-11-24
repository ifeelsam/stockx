"use client";
import { useState } from "react";
import { rtp, totalWeight } from "@scratchers/sdk";
import { tierByIndex } from "@scratchers/ui-tokens";
import { SERIES, TIER_NAMES, VISIBLE_SERIES } from "@scratchers/app-core";

export default function Prizes() {
  const [sid, setSid] = useState(1);
  const s = SERIES.find((x) => x.id === sid)!;
  const total = totalWeight(s.tiers);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Prize table</h1>
        <p className="mt-1 text-dim">Frozen on chain before sales open. Result = u64(seed[0..8]) mod {total.toLocaleString()} → tier.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {VISIBLE_SERIES.map((x) => (
          <button key={x.id} onClick={() => setSid(x.id)} className={`rounded-lg border px-3 py-1.5 text-sm ${x.id === sid ? "border-money text-money" : "border-line text-dim"}`}>
            {x.name}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-dim">
            <tr>
              <th className="p-3">Tier</th><th className="p-3">Multiplier</th><th className="p-3">Odds</th><th className="hidden p-3 text-right sm:table-cell">Weight</th><th className="p-3 text-right">RTP</th>
            </tr>
          </thead>
          <tbody>
            {s.tiers.map((t, i) => (
              <tr key={i} className="border-t border-line">
                <td className="p-3 font-semibold" style={{ color: tierByIndex(i).color }}>{TIER_NAMES[i]}</td>
                <td className="num p-3">{t.multiplier}×</td>
                <td className="num p-3">1 in {(total / t.weight).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="num hidden p-3 text-right sm:table-cell">{t.weight.toLocaleString()}</td>
                <td className="num p-3 text-right">{((t.multiplier * t.weight) / total * 100).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-line bg-surface">
            <tr><td className="p-3 font-bold" colSpan={3}>Total</td><td className="num hidden p-3 text-right sm:table-cell">{total.toLocaleString()}</td><td className="num p-3 text-right font-bold text-money">{(rtp(s.tiers) * 100).toFixed(2)}%</td></tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-dim">Wins pay <span className="num">multiplier × ticket ÷ locked price</span> in tokenized shares, floored to 6 decimals.</p>
    </div>
  );
}
