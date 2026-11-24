"use client";
import { animate } from "motion/react";
import { useEffect, useState } from "react";
import { timing } from "@scratchers/ui-tokens";

export function CountUp({ to, prefix = "$", decimals = 2, ms = timing.countUp }: { to: number; prefix?: string; decimals?: number; ms?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, to, { duration: ms / 1000, ease: [0.16, 1, 0.3, 1], onUpdate: setV });
    return () => c.stop();
  }, [to, ms]);
  return <span className="num">{prefix}{v.toFixed(decimals)}</span>;
}
