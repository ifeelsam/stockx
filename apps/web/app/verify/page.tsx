"use client";
import { useEffect, useState } from "react";
import { cardArt, totalWeight } from "@scratchers/sdk";
import { tierByMultiplier, TIERS, TIER_KEYS } from "@scratchers/ui-tokens";
import { SERIES, seriesById, useGame } from "@scratchers/app-core";
import { Gem, HoloCard } from "@/components/HoloCard";
import { Symbol } from "@/components/Symbol";
import { cardUsd, cardView } from "@/lib/cards";

const fromHex = (s: string) => {
  const c = s.trim().replace(/^0x/, "");
  return /^[0-9a-fA-F]{64}$/.test(c) ? Uint8Array.from(c.match(/../g)!.map((b) => parseInt(b, 16))) : undefined;
};
const toHex = (u: Uint8Array) => [...u].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Proof: redo the roll from the VRF seed with the same open code the app uses. */
export default function Proof() {
  const g = useGame();
  const [q, setQ] = useState("");
  const [sid, setSid] = useState(11);
  useEffect(() => setQ(new URLSearchParams(window.location.search).get("c") ?? ""), []);

  const num = q.replace(/[№\s]/g, "");
  const local = /^\d+$/.test(num) ? g.cards.find((c) => c.id === Number(num)) : undefined;
  const seed = local?.seed ?? fromHex(q);
  const series = seriesById(local?.seriesId ?? sid);
  const art = seed && cardArt(seed, series.tiers);
  const total = totalWeight(series.tiers);
  const first8 = seed && new DataView(seed.buffer, seed.byteOffset, 8).getBigUint64(0, true);
  const roll = first8 !== undefined ? Number(first8 % BigInt(total)) : undefined;
  const tier = art && tierByMultiplier(art.multiplier);
  const face = art && seed && cardView({ id: local?.id ?? 0, seriesId: series.id, state: "revealed", seed, art, lockedPrice: local?.lockedPrice ?? 0, shares: local?.shares ?? 0, flipped: true }, g.prices).face;
  const mismatch = !!(local?.art && art && local.art.tier !== art.tier);
  let from = 0;

  return (
    <div className="flex flex-wrap items-start gap-10 py-2">
      <section className="flex min-w-0 flex-[1_1_400px] flex-col gap-4">
        <h1 className="text-6xl font-extrabold tracking-tight">Flip any card.</h1>
        <p className="max-w-md text-[17px] leading-relaxed text-[#C9C2E6]">The odds are frozen on chain before the first pack sells. Each card's rarity comes from a MagicBlock VRF seed, so anyone can redo the sum below and get the same answer.</p>
        <label htmlFor="serial" className="mt-2 text-sm font-semibold text-[#C9C2E6]">Card number, or its VRF seed (64 hex characters)</label>
        <input id="serial" value={q} onChange={(e) => setQ(e.target.value)} placeholder="000012" className="num min-h-[52px] max-w-lg rounded-xl border border-[#3A3350] bg-surface px-4 text-[15px] outline-none focus:border-accent" />
        {!local && (
          <select aria-label="Pack the seed came from" value={sid} onChange={(e) => setSid(Number(e.target.value))} className="max-w-lg rounded-xl border border-[#3A3350] bg-surface px-3 py-2.5 text-sm">
            {SERIES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {q && !seed && <p className="text-sm text-danger">{local ? "That card is still waiting for randomness." : "No revealed card of yours has that number, and it is not a 32-byte hex seed."}</p>}
        {seed && roll !== undefined && (
          <dl className="num mt-3 max-w-lg text-sm [&>div]:flex [&>div]:justify-between [&>div]:gap-4 [&>div]:border-b [&>div]:border-line [&>div]:py-2.5 [&_dt]:text-[#C9C2E6]">
            <div><dt>vrf seed</dt><dd className="truncate">{toHex(seed)}</dd></div>
            <div><dt>first 8 bytes (u64, LE)</dt><dd>{first8!.toLocaleString("en-US")}</dd></div>
            <div className="font-bold"><dt>mod {total.toLocaleString("en-US")}</dt><dd style={{ color: tier!.color }}>= {roll.toLocaleString("en-US")}</dd></div>
          </dl>
        )}
      </section>

      {art && face && tier && (
        <section className="flex min-w-0 flex-[1_1_520px] flex-wrap items-start gap-7">
          <div className="flex flex-col gap-3">
            <HoloCard {...face} {...(local ? {} : { shares: "from seed only", now: undefined, usd: cardUsd(art.multiplier * series.ticketUsd), serial: "——" })} />
            <div className="grid w-[286px] grid-cols-9 gap-0.5" aria-label="Panel symbols derived from the seed">
              {art.panels.map((s, i) => <Symbol key={i} name={s} size={30} color={art.winningPanels.includes(i) ? tier.color : "#6F6A80"} glow={false} />)}
            </div>
          </div>
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2">
            <span className="text-sm font-bold text-[#C9C2E6]">Where {roll!.toLocaleString("en-US")} lands</span>
            {TIER_KEYS.map((k, i) => {
              const lo = from;
              from += series.tiers[i].weight;
              const hit = i === art.tier;
              return (
                <div key={k} className="flex min-h-[30px] items-center gap-2.5 rounded-lg px-2.5" style={hit ? { background: TIERS[k].color, color: "#0D0B14", fontWeight: 800 } : { background: "#1B1726", color: "#C9C2E6" }}>
                  <Gem fill={hit ? "#0D0B14" : TIERS[k].color} size={10} />
                  <span className="w-24 text-sm">{TIERS[k].label}</span>
                  <span className="num ml-auto text-[11px]">{lo.toLocaleString("en-US")} – {(from - 1).toLocaleString("en-US")}</span>
                </div>
              );
            })}
            <div role="status" className={`mt-2 rounded-xl border px-3.5 py-3 text-[15px] font-bold ${mismatch ? "border-danger text-danger" : "border-[#3E8F55] bg-[#10241A] text-[#CDEBD6]"}`}>
              {mismatch ? "Does not match the recorded result." : local ? `✓ ${tier.label} band. Matches ${g.backend === "chain" ? "the card on chain" : "the recorded result"}.` : `${tier.label} band.`}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
