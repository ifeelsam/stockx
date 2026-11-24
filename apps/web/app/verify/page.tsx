"use client";
import { useMemo, useState } from "react";
import { cardArt, tierFor } from "@scratchers/sdk";
import { tierByMultiplier } from "@scratchers/ui-tokens";
import { SERIES } from "@/lib/series";
import { useGame } from "@/lib/game";
import { Symbol } from "@/components/Symbol";

const hex = (s: string) => {
  const c = s.trim().replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(c)) return null;
  return Uint8Array.from(c.match(/../g)!.map((b) => parseInt(b, 16)));
};
const toHex = (u: Uint8Array) => [...u].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Recompute from a seed (hex) or, on the mock backend, a local card id. */
export default function Verify() {
  const g = useGame();
  const [q, setQ] = useState("");
  const [sid, setSid] = useState(1);
  const local = /^\d+$/.test(q.trim()) ? g.cards.find((c) => c.id === Number(q.trim())) : undefined;
  const seed = local?.seed ?? hex(q);
  const series = SERIES.find((s) => s.id === (local?.seriesId ?? sid))!;
  const out = useMemo(() => (seed ? { art: cardArt(seed, series.tiers), tier: tierFor(seed, series.tiers) } : null), [seed, series]);
  const recorded = local?.art;
  const t = out && tierByMultiplier(out.art.multiplier);
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-3xl font-black">Verify a card</h1>
      <p className="text-dim">Paste a card seed (64 hex chars from the on-chain card) or a card # from this session. We recompute the tier and the panel art with the same open code the app uses.</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="card id or seed hex" className="num w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-money" />
      {!local && (
        <select value={sid} onChange={(e) => setSid(Number(e.target.value))} className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm">
          {SERIES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      {q && !seed && <p className="text-sm text-danger">Not a valid card id or 32-byte hex seed.</p>}
      {out && t && (
        <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <div className="text-xl font-bold" style={{ color: t.color }}>{t.label}</div>
            <div className="num text-dim">tier {out.tier} · {out.art.multiplier}×</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {out.art.panels.map((s, i) => {
              const w = out.art.winningPanels.includes(i);
              return (
                <div key={i} className="flex aspect-square items-center justify-center rounded-xl bg-surface-hi" style={w ? { outline: `1.5px solid ${t.color}` } : undefined}>
                  <Symbol name={s} size={36} color={w ? t.color : "#8B93A7"} />
                </div>
              );
            })}
          </div>
          <div className="num break-all text-xs text-dim">seed {toHex(seed!)}</div>
          {recorded && (
            <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${recorded.tier === out.tier ? "bg-money/15 text-money" : "bg-danger/15 text-danger"}`}>
              {recorded.tier === out.tier ? "✓ Matches the recorded result" : "✗ Does not match the recorded result"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
