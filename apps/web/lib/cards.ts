import { seriesById, type Prices, type UiCard } from "@scratchers/app-core";
import { tierByMultiplier } from "@scratchers/ui-tokens";
import type { CardFace } from "@/components/HoloCard";

export const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** "▲ $1.20" in accent, "▼ $0.30" in red; under half a cent is flat, not a loss. */
export const change = (d: number) => ({ text: `${d <= -0.005 ? "▼" : d >= 0.005 ? "▲" : "±"} ${money(Math.abs(d))}`, cls: d <= -0.005 ? "text-danger" : "text-accent" });
/** The value printed on a card: beside "1,000×" the cents do not fit. */
export const cardUsd = (n: number) => (n >= 100 ? `$${n.toLocaleString("en-US")}` : money(n));
export const serialOf = (id: number) => String(id).padStart(6, "0");

/** Everything a screen says about one revealed card. Dust is a partial refund, never a win. */
export function cardView(c: UiCard & { art: NonNullable<UiCard["art"]> }, prices: Prices) {
  const s = seriesById(c.seriesId);
  const t = tierByMultiplier(c.art.multiplier);
  const usd = c.art.multiplier * s.ticketUsd;
  const value = c.shares * (prices[s.feed] || c.lockedPrice);
  const mult = `${c.art.multiplier.toLocaleString("en-US")}×`;
  const face: CardFace = {
    feed: s.feed,
    rarity: t.key,
    mult,
    usd: cardUsd(usd),
    shares: `${c.shares.toFixed(6)} shares`,
    now: `now ${money(value)} ${value >= c.shares * c.lockedPrice ? "▲" : "▼"}`,
    serial: serialOf(c.id),
    tilt: c.seed ? c.seed[24] / 255 : 0.35,
  };
  const caption =
    t.key === "dust"
      ? { title: "Dust", sub: `${Math.round(usd * 100)}¢ back in ${s.ticker}` }
      : t.key === "common"
        ? { title: "Common 1×", sub: `money back · ${money(usd)} in ${s.ticker}` }
        : { title: `${t.label} ${mult}`, sub: `${money(usd)} in ${s.ticker} · up ${money(usd - s.ticketUsd)}` };
  return { series: s, tier: t, usd, value, face, caption };
}
