"use client";
import { DEFAULT_TIERS, rtp, totalWeight } from "@scratchers/sdk";
import { tierByIndex } from "@scratchers/ui-tokens";
import { useGame } from "@scratchers/app-core";
import { TIER_NAMES } from "@scratchers/app-core";

export default function Dashboard() {
  const g = useGame();
  const { sold, tierCounts, paidShares } = g.stats;
  const total = totalWeight(DEFAULT_TIERS);
  const rows = DEFAULT_TIERS.map((t, i) => ({ i, name: TIER_NAMES[i], expected: (t.weight / total) * sold, actual: tierCounts[i] }));
  const max = Math.max(1, ...rows.flatMap((r) => [r.expected, r.actual]));
  const paidUsd = DEFAULT_TIERS.reduce((a, t, i) => a + tierCounts[i] * t.multiplier, 0);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black">Public dashboard</h1>
        <p className="text-dim">Actual vs expected payouts, and vault health. {g.backend === "mock" && "(Simulated session data until the devnet deploy.)"}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Cards sold", sold.toLocaleString()],
          ["Paid out (face)", `$${paidUsd.toLocaleString()}`],
          ["Realised RTP", sold ? `${((paidUsd / sold) * 100).toFixed(1)}%` : "n/a"],
          ["Target RTP", `${(rtp(DEFAULT_TIERS) * 100).toFixed(0)}%`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-surface p-4">
            <div className="text-sm text-dim">{k}</div>
            <div className="num mt-1 text-2xl font-bold">{v}</div>
          </div>
        ))}
      </div>
      <section>
        <h2 className="mb-3 font-bold">Wins per tier</h2>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.i} className="grid grid-cols-[90px_1fr_90px] items-center gap-3 text-sm">
              <span style={{ color: tierByIndex(r.i).color }}>{r.name}</span>
              <div className="space-y-1">
                <div className="h-2 rounded bg-line"><div className="h-2 rounded" style={{ width: `${(r.actual / max) * 100}%`, background: tierByIndex(r.i).color }} /></div>
                <div className="h-1 rounded bg-line"><div className="h-1 rounded bg-dim" style={{ width: `${(r.expected / max) * 100}%` }} /></div>
              </div>
              <span className="num text-right text-dim">{r.actual} / {r.expected.toFixed(1)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">Coloured bar = actual, grey = expected from the frozen table.</p>
      </section>
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-1 font-bold">Vault health</h2>
        <p className="text-sm text-dim">Shares paid this session: <span className="num">{paidShares.toFixed(4)}</span>. On devnet this panel reads VaultState (reserved vs available).</p>
      </section>
      <label className="flex items-center gap-2 text-xs text-dim">
        <input type="checkbox" checked={g.marketClosed} onChange={(e) => g.setMarketClosed(e.target.checked)} />
        simulate closed US market (mock backend)
      </label>
    </div>
  );
}
