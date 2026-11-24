"use client";
import confetti from "canvas-confetti";
import { haptics, tierByMultiplier, type TierStyle } from "@scratchers/ui-tokens";

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function vibrate(pattern: number[]) {
  if (pattern.length && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
}

/** Tier-scaled reveal effect. Returns the style so callers can add shake / jackpot overlay. */
export function revealFx(multiplier: number): TierStyle {
  const t = tierByMultiplier(multiplier);
  vibrate(haptics[t.fx]);
  if (reduced()) return t;
  const colors = [t.color, t.glow, "#ffffff"];
  switch (t.fx) {
    case "burst":
      confetti({ particleCount: 40, spread: 70, startVelocity: 28, origin: { y: 0.6 }, colors, scalar: 0.9, shapes: ["circle"] });
      break;
    case "shake":
      confetti({ particleCount: 140, spread: 100, startVelocity: 45, origin: { y: 0.55 }, colors });
      break;
    case "jackpot": {
      const end = Date.now() + 4000;
      (function frame() {
        confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0 }, colors });
        confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
      break;
    }
  }
  return t;
}
