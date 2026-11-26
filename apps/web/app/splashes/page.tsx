"use client";
import { useCallback, useState } from "react";
import { cardUsd, money, oddsText, SPLASH, TIERS, TIER_KEYS, type TierKey } from "@scratchers/ui-tokens";
import { multiplierOf, totalWeight, DEFAULT_TIERS } from "@scratchers/sdk";
import { RaritySplash } from "@/components/RaritySplash";

/** Replay any rarity splash without waiting to pull it (Dust and Common have none: they are not wins). */
export default function Splashes() {
  const [show, setShow] = useState<TierKey | null>(null);
  const close = useCallback(() => setShow(null), []);
  const i = show ? TIER_KEYS.indexOf(show) : 0;
  const m = multiplierOf(DEFAULT_TIERS[i]);
  return (
    <div className="space-y-5">
      <h1 className="text-5xl font-extrabold tracking-tight">Rarity splashes</h1>
      <p className="max-w-xl text-[#C9C2E6]">What plays when you pull each rarity. A preview only: nothing is bought or drawn.</p>
      <div className="flex flex-wrap gap-3">
        {TIER_KEYS.filter((k) => SPLASH[k]).map((k) => (
          <button key={k} onClick={() => setShow(k)} className="btn-ghost" style={{ borderColor: TIERS[k].color, color: TIERS[k].color }}>
            {TIERS[k].label}
          </button>
        ))}
      </div>
      {show && (
        <RaritySplash rarity={show} feed="TSLA" mult={`${m.toLocaleString("en-US")}×`} usd={m >= 100 ? cardUsd(m) : money(m)} odds={oddsText(DEFAULT_TIERS[i].weight, totalWeight(DEFAULT_TIERS))} onClose={close} />
      )}
    </div>
  );
}
