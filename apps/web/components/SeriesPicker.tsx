"use client";
import { VISIBLE_SERIES, type SeriesInfo } from "@scratchers/app-core";
import { useGame, isPaused } from "@scratchers/app-core";
import { Symbol } from "./Symbol";

export function SeriesPicker({ value, onChange }: { value: number; onChange: (id: number) => void }) {
  const g = useGame();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {VISIBLE_SERIES.map((s: SeriesInfo) => {
        const paused = isPaused(g, s.feed);
        const on = value === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className={`rounded-2xl border p-4 text-left transition ${on ? "border-accent bg-surface-hi" : "border-line bg-surface hover:bg-surface-hi"}`}
          >
            <div className="flex items-center justify-between">
              <Symbol name={s.feed === "SOL" ? "bolt" : s.feed === "TSLA" ? "rocket" : "gem"} color={on ? "#6EF7A8" : "#9A93AE"} size={28} />
              {s.demo && <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold">DEMO ODDS</span>}
              {paused && <span className="rounded bg-warn/20 px-1.5 py-0.5 text-[10px] font-bold text-warn">PAUSED</span>}
            </div>
            <div className="mt-3 font-semibold">{s.name}</div>
            <div className="num text-sm text-dim">
              {s.ticker} ${g.prices[s.feed].toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-dim">{s.blurb}</div>
          </button>
        );
      })}
    </div>
  );
}
