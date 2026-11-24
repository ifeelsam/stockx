"use client";
import { useState } from "react";
import { useGame } from "@/lib/game";
import { Sparkline } from "@/components/Sparkline";

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;

export default function Portfolio() {
  const g = useGame();
  const [sel, setSel] = useState<string | null>(null);
  const total = g.holdings.reduce((a, h) => a + h.shares * g.prices[h.feed], 0);
  const cost = g.holdings.reduce((a, h) => a + h.costUsd, 0);
  const cur = g.holdings.find((h) => h.ticker === sel) ?? g.holdings[0];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Portfolio</h1>
        <div className="mt-2 flex items-baseline gap-4">
          <span className="num text-4xl font-bold">{usd(total)}</span>
          {g.holdings.length > 0 && <span className={`num ${total >= cost ? "text-money" : "text-danger"}`}>{total >= cost ? "+" : ""}{usd(total - cost)} since wins</span>}
        </div>
      </div>
      {g.holdings.length === 0 ? (
        <p className="text-dim">No shares yet. Win a card and claim it.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-dim">
                <tr><th className="p-3">Stock</th><th className="p-3 text-right">Shares</th><th className="p-3 text-right">Price</th><th className="p-3 text-right">Value</th><th className="p-3 text-right">P/L</th><th className="p-3" /></tr>
              </thead>
              <tbody>
                {g.holdings.map((h) => {
                  const v = h.shares * g.prices[h.feed];
                  return (
                    <tr key={h.ticker} onClick={() => setSel(h.ticker)} className="cursor-pointer border-t border-line hover:bg-surface-hi">
                      <td className="p-3 font-semibold">{h.ticker}</td>
                      <td className="num p-3 text-right">{h.shares.toFixed(4)}</td>
                      <td className="num p-3 text-right">{usd(g.prices[h.feed])}</td>
                      <td className="num p-3 text-right">{usd(v)}</td>
                      <td className={`num p-3 text-right ${v >= h.costUsd ? "text-money" : "text-danger"}`}>{usd(v - h.costUsd)}</td>
                      <td className="p-3 text-right">
                        <button onClick={(e) => { e.stopPropagation(); g.sell(h.ticker, h.shares); }} className="rounded-lg border border-line px-3 py-1 hover:bg-surface-hi">Sell all</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {cur && (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="mb-2 text-sm text-dim">{cur.ticker} live price · rollup feed</div>
              <Sparkline data={g.history[cur.feed]} />
            </div>
          )}
        </>
      )}
      <p className="text-xs text-dim">Selling uses the vault at the validated price on devnet (<span className="num">sell_to_vault</span>). Mainnet routes via the MagicBlock Payments API.</p>
    </div>
  );
}
