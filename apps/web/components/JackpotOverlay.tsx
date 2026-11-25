"use client";
import { AnimatePresence, motion } from "motion/react";
import { TIERS } from "@scratchers/ui-tokens";
import { Symbol } from "./Symbol";
import { CountUp } from "./CountUp";

/** Full-screen Grail moment. A Rive file can replace the backdrop later (see docs/DECISIONS.md). */
export function JackpotOverlay({ open, usd, onClose }: { open: boolean; usd: number; onClose: () => void }) {
  const t = TIERS.grail;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center"
          style={{ background: "radial-gradient(circle at 50% 45%, #5a3d00ee 0%, #0d0b14f2 70%)" }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border-2"
              style={{ borderColor: t.color, width: 200, height: 200 }}
              initial={{ scale: 0.2, opacity: 0.9 }}
              animate={{ scale: 6, opacity: 0 }}
              transition={{ duration: 2.4, delay: i * 0.5, repeat: Infinity, ease: "easeOut" }}
            />
          ))}
          <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 180, damping: 12 }}>
            <Symbol name="bull" color={t.color} size={160} glow />
          </motion.div>
          <motion.h1 initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="mt-6 text-5xl font-black tracking-tight" style={{ color: t.color }}>
            GRAIL · 1,000×
          </motion.h1>
          <div className="mt-3 text-4xl font-bold text-text">
            <CountUp to={usd} prefix="$" />
          </div>
          <p className="mt-2 text-sm text-dim">in tokenized stock</p>
          <p className="mt-6 text-sm text-dim">tap to continue</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
