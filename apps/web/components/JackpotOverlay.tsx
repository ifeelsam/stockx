"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useGame, type UiCard } from "@scratchers/app-core";
import { CountUp } from "./CountUp";
import { HoloCard } from "./HoloCard";
import { cardView } from "@/lib/cards";

/** Full-screen Grail moment (design "04 · Grail pull"). A Rive file can replace the backdrop later (see docs/DECISIONS.md). */
export function JackpotOverlay({ card, onClose, onClaim }: { card: (UiCard & { art: NonNullable<UiCard["art"]> }) | null; onClose: () => void; onClaim: () => void }) {
  const g = useGame();
  const v = card && cardView(card, g.prices);
  return (
    <AnimatePresence>
      {card && v && (
        <motion.div role="dialog" aria-label="Grail pull" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-ink">
          {/* phone-width column on every screen, so the lettering sits behind the card and never behind the caption */}
          <div className="relative flex w-full max-w-[390px] flex-col items-center gap-6 px-6 pt-10">
          <span aria-hidden="true" className="pointer-events-none absolute -left-3 top-0 whitespace-nowrap text-[min(43vw,168px)] font-extrabold leading-[0.9] tracking-[-0.06em] text-gold">
            GRAIL
            <br />
            <span className="text-transparent [-webkit-text-stroke:2px_#FFD84D]">GRAIL</span>
          </span>
          <motion.div initial={{ y: 60, scale: 0.9, rotate: -4, opacity: 0 }} animate={{ y: 0, scale: 1, rotate: -3, opacity: 1 }} transition={{ type: "spring", stiffness: 160, damping: 14 }} className="relative">
            <HoloCard {...v.face} width={286} />
          </motion.div>
          <div className="relative text-center">
            <div className="text-3xl font-extrabold tracking-tight">A Grail {v.series.feed}.</div>
            <div className="text-3xl font-extrabold text-gold"><CountUp to={v.usd} /></div>
            <div className="text-[15px] text-[#C9C2E6]">{v.caption.sub}{v.series.demo ? " · demo odds" : ""}</div>
          </div>
          <div className="relative flex w-full max-w-sm gap-2.5">
            <Link href={`/verify?c=${card.id}`} onClick={onClose} className="flex min-h-14 flex-1 items-center justify-center rounded-[14px] border-2 border-gold bg-ink font-extrabold text-gold">
              See the proof
            </Link>
            <button onClick={onClaim} className="min-h-14 flex-[1.4] rounded-[14px] bg-gold font-extrabold text-ink">Add to binder</button>
          </div>
          <button onClick={onClose} className="relative text-sm text-dim underline">Close</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
