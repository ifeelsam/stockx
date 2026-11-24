"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { colors, SCRATCH_REVEAL_THRESHOLD, tierByMultiplier } from "@scratchers/ui-tokens";
import type { CardArt } from "@scratchers/sdk";
import { Symbol } from "./Symbol";
import { revealFx, vibrate } from "@/lib/fx";

const W = 300;
const H = 300;

function paintFoil(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#3A4154");
  g.addColorStop(0.5, "#6B7390");
  g.addColorStop(1, "#2A2F3D");
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // fine grain so it reads as foil
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 18px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.fillText("SCRATCH HERE", W / 2, H / 2 + 6);
}

export function ScratchCard({ art, scratched, onDone, disabled }: { art: CardArt; scratched: boolean; onDone: () => void; disabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const moves = useRef(0);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [cleared, setCleared] = useState(scratched);
  const [shake, setShake] = useState(false);
  const tier = tierByMultiplier(art.multiplier);

  const finish = useCallback(() => {
    setCleared(true);
    const t = revealFx(art.multiplier);
    if (t.fx === "shake" || t.fx === "jackpot") {
      setShake(true);
      setTimeout(() => setShake(false), 450);
    }
    onDone();
  }, [art.multiplier, onDone]);

  useEffect(() => {
    const c = ref.current;
    if (!c || cleared) return;
    c.width = W;
    c.height = H;
    paintFoil(c.getContext("2d")!);
  }, [cleared]);

  const clearedFraction = () => {
    const ctx = ref.current!.getContext("2d")!;
    const d = ctx.getImageData(0, 0, W, H).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4 * 16) if (d[i] < 16) n++;
    return n / (d.length / (4 * 16));
  };

  const scratch = (e: React.PointerEvent) => {
    if (!drawing.current || cleared || disabled) return;
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    const ctx = c.getContext("2d")!;
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 44;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(last.current?.x ?? x, last.current?.y ?? y);
    ctx.lineTo(x, y);
    ctx.stroke();
    last.current = { x, y };
    if (++moves.current % 6 === 0) {
      vibrate([8]);
      checkDone();
    }
  };

  const checkDone = () => {
    if (!cleared && clearedFraction() >= SCRATCH_REVEAL_THRESHOLD) finish();
  };
  const stop = () => {
    drawing.current = false;
    last.current = null;
    checkDone();
  };

  return (
    <div className={`relative select-none ${shake ? "shake" : ""}`} style={{ width: "100%", maxWidth: W, aspectRatio: "1" }}>
      <div className="absolute inset-0 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface p-3" style={cleared && art.win ? { boxShadow: `0 0 40px ${tier.glow}55`, borderColor: tier.color } : undefined}>
        {art.panels.map((s, i) => {
          const win = art.winningPanels.includes(i);
          return (
            <motion.div
              key={i}
              initial={false}
              animate={cleared && win ? { scale: [1, 1.12, 1], transition: { delay: 0.1 * art.winningPanels.indexOf(i), duration: 0.5 } } : { scale: 1 }}
              className="flex items-center justify-center rounded-xl bg-surface-hi"
              style={cleared && win ? { background: `${tier.color}22`, outline: `1.5px solid ${tier.color}` } : undefined}
            >
              <Symbol name={s} color={cleared && win ? tier.color : colors.textDim} size={44} glow={cleared && win} />
            </motion.div>
          );
        })}
      </div>
      {!cleared && (
        <canvas
          ref={ref}
          className="absolute inset-0 h-full w-full cursor-grab touch-none rounded-2xl"
          onPointerDown={(e) => {
            drawing.current = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            scratch(e);
          }}
          onPointerMove={scratch}
          onPointerUp={stop}
          onPointerCancel={stop}
        />
      )}
      {!cleared && !disabled && (
        <button onClick={finish} className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs text-dim underline">
          reveal all
        </button>
      )}
    </div>
  );
}
