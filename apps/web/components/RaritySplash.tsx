"use client";
import { useEffect, type CSSProperties } from "react";
import { SPLASH, SPLASH_MS, STOCK_LOOK, TIERS, type Feed, type TierKey } from "@scratchers/ui-tokens";

const at = (extra: CSSProperties = {}): CSSProperties => ({ position: "absolute", left: "50%", top: "42%", width: 0, height: 0, ...extra });
const vars = (v: Record<string, string>) => v as CSSProperties;

/** The splash for a pull of Uncommon or better (design "Rarity splashes"). Click, press a key, or wait. */
export function RaritySplash({ rarity, feed, mult, usd, odds, onClose }: { rarity: TierKey; feed: Feed; mult: string; usd: string; odds: string; onClose: () => void }) {
  const R = SPLASH[rarity]!;
  const c = TIERS[rarity].color;
  const alpha = (o: number) => c + Math.round(o * 255).toString(16).padStart(2, "0");
  useEffect(() => {
    const t = setTimeout(onClose, SPLASH_MS);
    return () => clearTimeout(t);
  }, [onClose]);
  const n = (count: number) => Array.from({ length: count }, (_, i) => i);
  return (
    <button type="button" autoFocus onClick={onClose} aria-label={`${TIERS[rarity].label} pull. See your card`} className="splash-in fixed inset-0 z-[60] block h-full w-full cursor-pointer overflow-hidden text-text outline-none" style={{ background: R.bg }}>
      <span aria-hidden="true" className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 42%, ${alpha(R.glow)}, ${alpha(0)} 60%)` }} />
      {R.prism && (
        <>
          <span aria-hidden="true" className="splash-hue absolute -inset-[20%] opacity-55" style={{ background: "conic-gradient(from 0deg at 50% 42%, #ff5c8a, #ffb86b, #feff9c, #7afcff, #b28dff, #ff5c8a)" }} />
          <span aria-hidden="true" className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 42%, rgba(13,11,20,0) 0%, rgba(13,11,20,0.35) 45%, rgba(13,11,20,0.85) 85%)" }} />
        </>
      )}
      {R.rays && (
        <span aria-hidden="true" className="splash-spin absolute left-1/2 top-[42%] h-[1200px] w-[1200px]" style={{ background: `repeating-conic-gradient(from 0deg, ${alpha(R.rays.opacity)} 0deg ${120 / R.rays.count}deg, ${alpha(0)} ${120 / R.rays.count}deg ${360 / R.rays.count}deg)`, maskImage: "radial-gradient(circle, #000 0%, transparent 58%)", WebkitMaskImage: "radial-gradient(circle, #000 0%, transparent 58%)" }} />
      )}
      <span aria-hidden="true" style={at()}>
        {n(R.rings).map((i) => <span key={i} className="splash-ring absolute left-0 top-0 h-[220px] w-[220px] rounded-full" style={{ border: `${4 - i * 0.8}px solid ${c}`, animationDelay: `${i * 0.4}s` }} />)}
        {R.warp && n(28).map((i) => (
          <span key={i} className="splash-warp absolute left-0 top-0 h-0.5 w-[70px] origin-left" style={{ ...vars({ "--a": `${(i * 360) / 28 + (i % 3) * 4}deg` }), background: `linear-gradient(90deg, transparent, ${R.warp![i % R.warp!.length]})`, animationDuration: `${0.9 + (i % 5) * 0.18}s`, animationDelay: `${-i * 0.11}s` }} />
        ))}
        {R.shards && n(10).map((i) => {
          const a = (i / 10) * Math.PI * 2 + 0.3;
          const d = 150 + (i % 3) * 40;
          const cols = R.prism ? R.warp! : [c, "#FFFFFF"];
          return <span key={i} className="splash-shard absolute -left-[9px] -top-[9px] h-[18px] w-[18px]" style={{ ...vars({ "--dx": `${Math.round(Math.cos(a) * d)}px`, "--dy": `${Math.round(Math.sin(a) * d)}px`, "--r": `${(i * 77) % 360}deg` }), background: cols[i % cols.length], clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }} />;
        })}
      </span>
      {R.embers && n(18).map((i) => {
        const col = R.embers![i % 3];
        return <span key={i} aria-hidden="true" className="splash-ember absolute -bottom-5 rounded-full" style={{ left: `${(i * 53 + 11) % 100}%`, width: 4 + (i % 4) * 2, height: 4 + (i % 4) * 2, background: col, boxShadow: `0 0 10px ${col}`, animationDuration: `${2.6 + (i % 5) * 0.5}s`, animationDelay: `${-i * 0.37}s` }} />;
      })}
      {R.sparkle && n(16).map((i) => (
        <svg key={i} aria-hidden="true" className="tw absolute" width={10 + (i % 4) * 6} height={10 + (i % 4) * 6} viewBox="0 0 20 20" style={{ left: `${(i * 89 + 23) % 96}%`, top: `${(i * 37 + 5) % 94}%`, animationDuration: `${1.4 + (i % 4) * 0.4}s`, animationDelay: `${-i * 0.29}s` }}>
          <path d="M10 0 C11 7 13 9 20 10 C13 11 11 13 10 20 C9 13 7 11 0 10 C7 9 9 7 10 0 Z" fill={["#FFD84D", "#FFFFFF", "#FFF3B0"][i % 3]} />
        </svg>
      ))}

      <span className="absolute left-1/2 top-[42%] block h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2">
        <span className="splash-gem block" style={{ filter: `drop-shadow(0 0 28px ${c})` }}>
          <svg className="splash-gemspin" aria-hidden="true" width="150" height="150" viewBox="0 0 150 150">
            <path d="M75 4 L146 75 L75 146 L4 75 Z" fill={c} />
            <path d="M75 4 L146 75 L75 75 Z" fill="rgba(255,255,255,0.35)" />
            <path d="M4 75 L75 146 L75 75 Z" fill="rgba(0,0,0,0.25)" />
            <path d="M75 34 L116 75 L75 116 L34 75 Z" fill="none" stroke="rgba(13,11,20,0.55)" strokeWidth="3" />
          </svg>
        </span>
      </span>

      <span className="absolute inset-x-0 top-[calc(42%+110px)] flex flex-col items-center px-3 text-center">
        <span className="splash-word font-extrabold leading-[0.9] tracking-[-3px]" style={{ fontSize: `min(${R.size}px, 22vw)`, color: R.word, textShadow: `0 0 30px ${c}` }}>
          {rarity === "grail" ? "GRAIL" : TIERS[rarity].label}
        </span>
        <span className="splash-sub mt-3.5 text-[22px] font-extrabold">{STOCK_LOOK[feed].symbol} · {mult}</span>
        <span className="splash-sub num mt-1 text-[13px] text-[#E4DFF0]">{usd} in {STOCK_LOOK[feed].company} shares</span>
        <span className="splash-sub num mt-1.5 text-[11px]" style={{ color: c }}>{odds}</span>
      </span>
      <span className="shim absolute inset-x-0 bottom-10 text-center text-[15px] font-bold">click to see your card</span>
      {R.blackout && <span aria-hidden="true" className="splash-black pointer-events-none absolute inset-0 bg-black" />}
    </button>
  );
}
