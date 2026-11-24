"use client";
import { AnimatePresence, motion } from "motion/react";
import { useGame } from "@/lib/game";

type B = { key: string; tone: "info" | "warn" | "bad"; text: string };

/** Global status strip: randomness pending, market closed, payout settling, MagicBlock degraded. */
export function Banners() {
  const g = useGame();
  const pending = g.cards.filter((c) => c.state === "pending").length;
  const settling = g.cards.filter((c) => c.state === "claiming").length;
  const list: B[] = [];
  if (g.degraded.length) list.push({ key: "deg", tone: "bad", text: `MagicBlock degraded (${g.degraded.join(", ")}). Plays may be slow or paused.` });
  if (g.marketClosed) list.push({ key: "mkt", tone: "warn", text: "US market closed: TSLA / NVDA price paused. Try the always-on SOL series." });
  if (pending) list.push({ key: "vrf", tone: "info", text: `Randomness pending for ${pending} card${pending > 1 ? "s" : ""}…` });
  if (settling) list.push({ key: "set", tone: "info", text: `Settling ${settling} payout${settling > 1 ? "s" : ""} on Solana…` });
  const cls = { info: "bg-surface-hi text-text", warn: "bg-warn/15 text-warn", bad: "bg-danger/15 text-danger" };
  return (
    <div className="sticky top-14 z-30">
      <AnimatePresence initial={false}>
        {list.map((b) => (
          <motion.div key={b.key} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className={`overflow-hidden text-center text-sm ${cls[b.tone]}`}>
            <div className="px-4 py-2">{b.text}</div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
