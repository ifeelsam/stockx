"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isPaused, useGame, VISIBLE_SERIES } from "@scratchers/app-core";
import { HoloPack } from "./HoloPack";

const N = VISIBLE_SERIES.length;
const STEP = 236; // 220 pack + 16 gap
const COPIES = 5;
const LOOP = N * STEP;
const mod = (i: number) => ((i % N) + N) % N;

/**
 * The endless pack shelf (design "01 · Packs"): swipe, trackpad, drag, click or arrow keys; the middle pack
 * stands up. Five copies are laid out and the position jumps back by whole loops, which looks identical.
 */
export function PackShelf({ picked, onPick }: { picked: number; onPick: (i: number) => void }) {
  const g = useGame();
  const el = useRef<HTMLDivElement>(null);
  const [sx, setSx] = useState(2 * LOOP);
  const drag = useRef<{ x: number; from: number; moved: boolean } | null>(null);
  const wasDrag = useRef(false);
  const idx = Math.round(sx / STEP);

  useLayoutEffect(() => {
    el.current!.scrollLeft = 2 * LOOP;
  }, []);
  useEffect(() => {
    if (mod(idx) !== picked) onPick(mod(idx));
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  /** where a glide is heading, so quick repeats add up */
  const aim = useRef<number | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const go = (k: number) => {
    aim.current = k;
    el.current!.scrollTo({ left: k * STEP, behavior: "smooth" });
  };
  /** shortest way round to a series */
  const goSeries = (i: number) => {
    const from = aim.current ?? idx;
    let d = mod(i - from);
    if (d > N / 2) d -= N;
    go(from + d);
  };
  const shift = (px: number) => {
    el.current!.scrollLeft += px;
    if (drag.current) drag.current.from += px;
    if (aim.current !== null) aim.current += px / STEP;
  };
  /** Once at rest, return to the middle copy. Moving mid-glide would cancel the glide. */
  const rest = () => {
    if (drag.current) return;
    const k = Math.round(el.current!.scrollLeft / STEP);
    const home = 2 * N + mod(k);
    if (home !== k) shift((home - k) * STEP);
    aim.current = null;
  };

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-2">
      <div
        ref={el}
        role="listbox"
        aria-label="Packs"
        tabIndex={0}
        className="shelf flex w-full cursor-grab gap-4 overflow-x-auto pb-11 pt-8 active:cursor-grabbing"
        style={{ paddingInline: "calc(50% - 110px)" }}
        onScroll={(e) => {
          const x = e.currentTarget.scrollLeft;
          // a very long fling that nears an end cannot wait for rest
          if (x < STEP) shift(2 * LOOP);
          else if (x > (N * COPIES - 2) * STEP) shift(-2 * LOOP);
          setSx(e.currentTarget.scrollLeft);
          clearTimeout(idle.current);
          idle.current = setTimeout(rest, 140);
        }}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          go((aim.current ?? idx) + (e.key === "ArrowRight" ? 1 : -1));
        }}
        // touch and trackpads scroll natively; a mouse needs dragging
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return;
          wasDrag.current = false;
          drag.current = { x: e.clientX, from: e.currentTarget.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          if (!d.moved && Math.abs(e.clientX - d.x) > 5) {
            d.moved = wasDrag.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            e.currentTarget.style.scrollSnapType = "none";
          }
          if (d.moved) e.currentTarget.scrollLeft = d.from - (e.clientX - d.x);
        }}
        onPointerUp={(e) => {
          const moved = drag.current?.moved;
          drag.current = null;
          if (!moved) return;
          const n = e.currentTarget;
          go(Math.round(n.scrollLeft / STEP));
          setTimeout(() => (n.style.scrollSnapType = ""), 400);
        }}
      >
        {Array.from({ length: N * COPIES }, (_, k) => {
          const s = VISIBLE_SERIES[k % N];
          const d = (k * STEP - sx) / STEP;
          const ad = Math.min(Math.abs(d), 1);
          const near = Math.abs(d) < 3.5;
          return (
            <button
              key={k}
              role="option"
              aria-selected={k === idx}
              aria-label={`Choose the ${s.name}`}
              aria-hidden={k === idx ? undefined : true}
              tabIndex={-1}
              onClick={() => !wasDrag.current && go(k)}
              className="h-[330px] w-[220px] shrink-0 snap-center"
            >
              {/* tilt an inner layer: snapping aims at the button's box, which must not move */}
              <div className="origin-bottom" style={{ transform: `translateY(${ad * 10}px) rotate(${-Math.max(-1, Math.min(1, d)) * 4}deg) scale(${1 - ad * 0.13})`, opacity: 1 - ad * 0.35 }}>
                {near && <HoloPack feed={s.feed} demo={s.demo} paused={isPaused(g, s.feed)} />}
              </div>
            </button>
          );
        })}
      </div>
      <div role="group" aria-label="Choose a pack" className="flex flex-wrap justify-center gap-2">
        {VISIBLE_SERIES.map((s, i) => (
          <button key={s.id} aria-pressed={i === picked} onClick={() => goSeries(i)} className="chip">
            {s.demo ? "DEMO ODDS" : s.feed}
          </button>
        ))}
      </div>
    </div>
  );
}
