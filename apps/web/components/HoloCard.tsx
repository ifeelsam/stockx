"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { tierByMultiplier, timing } from "@scratchers/ui-tokens";
import type { CardArt } from "@scratchers/sdk";
import { Symbol } from "./Symbol";
import { revealFx } from "@/lib/fx";

/**
 * Holo pack card: face-down foil on the front, the revealed rarity on the back.
 * A single tap flips it. Dust is deliberately quiet: greyscale stock, no holo, no glow.
 */
export function HoloCard({
  art,
  flipped,
  onDone,
  disabled,
  cardId,
  ticker,
}: {
  art: CardArt;
  flipped: boolean;
  onDone: () => void;
  disabled?: boolean;
  cardId: number;
  ticker: string;
}) {
  const [open, setOpen] = useState(flipped);
  useEffect(() => setOpen(flipped), [flipped]);
  const tier = tierByMultiplier(art.multiplier);
  const dust = art.multiplierBps < 10_000;
  const holo = art.multiplierBps >= 20_000;
  const sheenOpacity = art.multiplierBps >= 1_000_000 ? 0.5 : art.multiplierBps >= 500_000 ? 0.42 : art.multiplierBps >= 100_000 ? 0.34 : 0.26;

  const flip = () => {
    if (open || disabled) return;
    setOpen(true);
    revealFx(art.multiplier);
    onDone();
  };

  return (
    <div className="group relative w-full max-w-[318px] select-none [perspective:1400px]" style={{ aspectRatio: "300 / 420" }}>
      <motion.div
        className="relative h-full w-full"
        initial={false}
        animate={{ rotateY: open ? 180 : 0 }}
        transition={{ duration: timing.flip / 1000, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* face down */}
        <button
          type="button"
          onClick={flip}
          disabled={disabled}
          aria-label={`Flip pack card #${cardId}`}
          className="holo-foil absolute inset-0 overflow-hidden rounded-[26px] border border-white/15 text-left shadow-[0_20px_60px_rgba(0,0,0,0.55)] outline-none transition disabled:cursor-default"
          style={{ backfaceVisibility: "hidden" }}
        >
          <span className="holo-drift pointer-events-none absolute -inset-8 opacity-70" style={{ background: "conic-gradient(from 40deg, transparent, rgba(157,243,255,.22), transparent 30%, rgba(255,122,209,.2), transparent 55%, rgba(247,212,92,.18), transparent 80%)" }} />
          <span className="relative flex h-full flex-col justify-between p-5">
            <span className="flex items-start justify-between text-[10px] font-bold uppercase tracking-[0.22em] text-white/75">
              <span>Stock<br />Scratchers</span>
              <span className="rounded-full border border-white/25 px-2 py-1 text-[9px] tracking-[0.18em]">Holo pack</span>
            </span>
            <span className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/5 shadow-[inset_0_0_40px_rgba(157,243,255,.25)]">
              <span className="text-4xl font-black tracking-tighter text-white/90">S</span>
            </span>
            <span className="flex items-end justify-between">
              <span className="num text-[10px] tracking-[0.18em] text-white/60">Nº {String(cardId).padStart(4, "0")}</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Tap to flip</span>
            </span>
          </span>
        </button>

        {/* face up */}
        <div
          className={`absolute inset-0 overflow-hidden rounded-[26px] border-[3px] p-4 ${dust ? "card-dust" : "card-stock"}`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", borderColor: dust ? "#A9A4B3" : tier.color, boxShadow: dust ? "0 14px 40px rgba(0,0,0,.45)" : `0 18px 60px ${tier.glow}44` }}
        >
          {holo && <span className="holo-sheen" style={{ opacity: sheenOpacity }} />}
          <div className="relative flex h-full flex-col">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] opacity-55">Stock Scratchers</div>
                <div className="mt-1 text-2xl font-extrabold leading-none tracking-tight" style={{ color: dust ? "#55505F" : tier.color }}>
                  {tier.label}
                </div>
              </div>
              <div className="num text-right text-[10px] uppercase leading-tight opacity-60">
                {ticker}
                <br />
                {tier.payout}
              </div>
            </div>

            <div className="mt-4 grid flex-1 grid-cols-3 gap-2">
              {art.panels.map((s, i) => {
                const hit = art.winningPanels.includes(i);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-center rounded-xl border"
                    style={{
                      borderColor: hit ? (dust ? "#8B8798" : tier.color) : "rgba(23,19,32,0.10)",
                      background: hit ? (dust ? "rgba(85,80,95,0.10)" : `${tier.color}22`) : "rgba(23,19,32,0.045)",
                    }}
                  >
                    <Symbol name={s} color={hit ? (dust ? "#55505F" : tier.color) : "#6E687A"} size={38} glow={false} />
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-end justify-between border-t border-black/10 pt-3">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-45">
                  {dust ? "Dust · not a win" : art.win ? "Rarity" : "Result"}
                </div>
                <div className="num text-sm font-bold" style={{ color: dust ? "#55505F" : tier.color }}>
                  {tier.payout}
                </div>
              </div>
              <div className="num text-[10px] tracking-[0.18em] opacity-45">Nº {String(cardId).padStart(4, "0")}</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
