import { STOCK_LOOK } from "@scratchers/ui-tokens";
import type { Feed } from "./HoloCard";
import { Gem } from "./HoloCard";
import { Scaled } from "./Scaled";

/** Foil pouch outline: crimped top and bottom seals, pinched sides (220×330, from the design canvas). */
const SHAPE = (() => {
  const W = 220, H = 330, Z = 5, n = 22, S = 26;
  let d = `M 0 ${Z}`;
  for (let k = 1; k <= n; k++) d += ` L ${((k * W) / n).toFixed(1)} ${k % 2 ? 0 : Z}`;
  d += ` L ${W} ${S} C ${W - 1} ${S + 6} ${W - 9} ${S + 10} ${W - 8} ${S + 22}`;
  d += ` C ${W + 1} ${H * 0.36} ${W + 1} ${H * 0.64} ${W - 8} ${H - S - 22} C ${W - 9} ${H - S - 10} ${W - 1} ${H - S - 6} ${W} ${H - S} L ${W} ${H - Z}`;
  for (let k = n - 1; k >= 0; k--) d += ` L ${((k * W) / n).toFixed(1)} ${k % 2 ? H : H - Z}`;
  d += ` L 0 ${H - S} C 1 ${H - S - 6} 9 ${H - S - 10} 8 ${H - S - 22} C -1 ${H * 0.64} -1 ${H * 0.36} 8 ${S + 22} C 9 ${S + 10} 1 ${S + 6} 0 ${S} Z`;
  return `path('${d}')`;
})();

const crimp = "repeating-linear-gradient(90deg, rgba(255,255,255,0.20) 0 1px, rgba(0,0,0,0.16) 1px 2px, transparent 2px 4px)";

export function HoloPack({ feed, count = 10, demo = false, paused = false, offset = 0, width = 220 }: { feed: Feed; count?: number; demo?: boolean; paused?: boolean; offset?: number; width?: number }) {
  const p = STOCK_LOOK[feed];
  const layer = (style: React.CSSProperties) => <div aria-hidden="true" className="absolute inset-x-0" style={style} />;
  return (
    <Scaled w={220} h={330} width={width}>
      <div className="relative h-[330px] w-[220px] text-text">
        <div className="absolute inset-0" style={{ filter: "drop-shadow(0 18px 18px rgba(0,0,0,0.45))" }}>
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: SHAPE, background: p.pack }}>
            {layer({ top: 0, bottom: 0, mixBlendMode: "soft-light", opacity: 0.95, background: `conic-gradient(from ${Math.round(200 + offset * 120)}deg at ${Math.round(40 + offset * 30)}% 30%, #ff6ec7, #7afcff, #feff9c, #b28dff, #ff6ec7)` })}
            {layer({ top: 0, bottom: 0, background: "linear-gradient(90deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.08) 14%, rgba(255,255,255,0.10) 34%, rgba(255,255,255,0) 55%, rgba(0,0,0,0.10) 80%, rgba(0,0,0,0.46) 100%)" })}
            {layer({ top: 28, bottom: 28, background: "radial-gradient(ellipse 62% 40% at 36% 32%, rgba(255,255,255,0.46), rgba(255,255,255,0) 70%), radial-gradient(ellipse 70% 38% at 62% 84%, rgba(0,0,0,0.30), rgba(0,0,0,0) 70%)" })}
            {layer({ top: 0, height: 26, background: crimp })}
            {layer({ top: 24, height: 26, background: "linear-gradient(180deg, rgba(0,0,0,0.38), rgba(0,0,0,0.12) 30%, rgba(255,255,255,0.18) 60%, rgba(255,255,255,0))" })}
            {layer({ bottom: 0, height: 26, background: crimp })}
            {layer({ bottom: 24, height: 26, background: "linear-gradient(0deg, rgba(0,0,0,0.42), rgba(0,0,0,0.14) 35%, rgba(0,0,0,0))" })}
            <div aria-hidden="true" className="absolute inset-x-[26px] inset-y-14 rounded-xl" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.15), 0 3px 8px rgba(0,0,0,0.2), inset 0 -2px 5px rgba(0,0,0,0.16)" }} />
            <span className="num absolute left-3.5 top-[9px] text-[8px] font-bold tracking-[1.5px] text-[#0D0B14]/80">SERIES 01 · {count} CARD{count > 1 ? "S" : ""}</span>
            <span className="num absolute right-3 top-[9px] text-[8px] font-bold text-[#0D0B14]/80">TEAR ›</span>
            <div className="absolute inset-x-0 inset-y-[26px] flex flex-col items-center justify-center gap-1 text-[#0D0B14]">
              <div
                className="flex h-[118px] w-[118px] items-center justify-center rounded-full"
                style={{ background: "radial-gradient(circle at 38% 32%, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), radial-gradient(circle at 60% 70%, rgba(0,0,0,0.25), rgba(0,0,0,0) 60%)", boxShadow: "inset 4px 5px 9px rgba(0,0,0,0.38), inset -4px -4px 8px rgba(255,255,255,0.4)" }}
              >
                {/* ticker text, not a company logo: we have no right to use one */}
                <span className="text-[34px] font-extrabold tracking-[-1.5px] mix-blend-multiply" style={{ color: p.pack, textShadow: "-1px -1px 0 rgba(255,255,255,0.55), 1.5px 1.5px 0 rgba(0,0,0,0.45)" }}>{p.symbol}</span>
              </div>
              <span className="mt-1.5 text-[22px] font-extrabold tracking-tight">{p.packName}</span>
              <div className="num mt-3.5 flex items-center gap-1.5 rounded-full bg-[#0D0B14] px-2.5 py-1.5 text-[10px] font-bold text-gold">
                <Gem fill="#FFD84D" size={10} />
                {demo ? "DEMO ODDS" : "GRAIL 1,000× INSIDE"}
              </div>
            </div>
          </div>
        </div>
        {paused && (
          <div className="absolute -inset-x-6 top-[138px] flex -rotate-[8deg] flex-col items-center border-2 border-text bg-ink py-2">
            <span className="text-[19px] font-extrabold">Price paused</span>
            <span className="num text-[11px] text-[#C9C2E6]">waiting for a fresh price</span>
          </div>
        )}
      </div>
    </Scaled>
  );
}
