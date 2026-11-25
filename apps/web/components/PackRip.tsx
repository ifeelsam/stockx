"use client";
import { useRef, useState } from "react";
import { HoloPack } from "./HoloPack";
import type { Feed } from "./HoloCard";

/** The sealed pack. Tearing it (drag across the seal, tap, or Enter) is the buy, so the price is on the control. */
export function PackRip({ feed, count, demo, paused, busy, price, onRip }: { feed: Feed; count: number; demo: boolean; paused: boolean; busy: boolean; price: string; onRip: () => void }) {
  const [tear, setTear] = useState(0);
  const drag = useRef<{ max: number } | null>(null);
  const off = paused || busy;
  const at = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left - 10) / (r.width - 20)));
  };
  const rip = () => {
    drag.current = null;
    setTear(0);
    if (!off) onRip();
  };
  const shown = busy ? 1 : tear;
  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${busy ? "pack-shake" : "bob"}`}>
        <HoloPack feed={feed} count={count} demo={demo} paused={paused} offset={shown * 0.8} width={286} />
        <button
          type="button"
          disabled={off}
          aria-label={`Tear the pack open and buy ${count} card${count > 1 ? "s" : ""} for ${price}`}
          className="absolute -inset-x-2.5 top-1.5 h-16 cursor-ew-resize touch-none disabled:cursor-default"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { max: at(e) * 0.3 };
            setTear(drag.current.max);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            drag.current.max = Math.max(drag.current.max, at(e));
            setTear(drag.current.max);
            if (drag.current.max > 0.88) rip();
          }}
          onPointerUp={() => {
            // a short press is a tap (rip); an abandoned drag springs back
            const m = drag.current?.max;
            if (m === undefined) return;
            if (m < 0.35) rip();
            else {
              drag.current = null;
              setTear(0);
            }
          }}
          onPointerCancel={() => {
            drag.current = null;
            setTear(0);
          }}
          onClick={(e) => e.detail === 0 && rip() /* keyboard */}
        >
          <span aria-hidden="true" className="absolute inset-x-2.5 top-9 border-t-2 border-dashed border-text/85" />
          <span aria-hidden="true" className="absolute left-2.5 top-[34px] h-1.5 rounded bg-text shadow-[0_0_12px_#9DF3FF]" style={{ width: `calc((100% - 20px) * ${shown})` }} />
          <span aria-hidden="true" className="absolute top-5 -ml-[17px] flex h-[34px] w-[34px] items-center justify-center rounded-full bg-text text-ink shadow-lg" style={{ left: `calc(10px + (100% - 20px) * ${shown})` }}>›</span>
        </button>
      </div>
      <div className="mt-10 text-center">
        <div className="text-3xl font-extrabold tracking-tight">{busy ? "Ripping…" : paused ? "Price paused" : "Tear it open"}</div>
        <div className="mt-1 text-[15px] text-[#C9C2E6]">{busy ? "Sending to the rollup" : paused ? "Packs resume with the next fresh price." : `Drag across the top seal → ${price}`}</div>
      </div>
    </div>
  );
}
