import { useId, type CSSProperties } from "react";
import { CARD_ART as A, CARD_BACK as B, FINISH, SPARKLES, STOCK_LOOK, TIERS, type CardFace, type Feed, type TierKey } from "@scratchers/ui-tokens";
import { Scaled } from "./Scaled";
import { LogoMark, Wordmark } from "./Logo";

export type { CardFace, Feed };


/** The brand mark as a glossy raised badge; `flat` is the faint one behind it. */
function BrandMark({ feed, size, flat, style }: { feed: Feed; size: number; flat?: boolean; style: CSSProperties }) {
  const c = STOCK_LOOK[feed].card;
  const id = useId().replace(/\W/g, "");
  const [x1, y1, x2, y2] = c.line;
  return (
    <svg aria-hidden="true" className="absolute overflow-visible" width={size} height={size} viewBox="-1.5 -1.5 27 28" style={style}>
      <defs>
        <linearGradient id={`f${id}`} x1={x1} y1={y1} x2={x2} y2={y2}>
          {c.face.map((color, i) => (
            <stop key={i} offset={[0, 0.28, 0.62, 1][i]} stopColor={color} />
          ))}
        </linearGradient>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.3" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.46" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.56" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {!flat && [6, 5, 4, 3, 2, 1].map((i) => <path key={i} d={c.logo} fill={c.extrude[i > 3 ? 0 : 1]} transform={`translate(0 ${i * 0.13})`} />)}
      <path d={c.logo} fill={`url(#f${id})`} />
      {!flat && (
        <>
          <path d={c.logo} fill={`url(#g${id})`} />
          <path d={c.logo} fill="none" stroke={c.rim} strokeOpacity="0.7" strokeWidth="0.09" />
        </>
      )}
    </svg>
  );
}

const fade = (stops: string): CSSProperties => ({ maskImage: stops, WebkitMaskImage: stops });

const Gem = ({ fill, size = 14 }: { fill: string; size?: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 14 14">
    <path d="M7 0 L14 7 L7 14 L0 7 Z" fill={fill} stroke="#0D0B14" strokeWidth="1" />
  </svg>
);
export { Gem };

/**
 * Face-down card: the same foil as the faces, in the house colours, so it gives nothing away.
 * `tease` lights it in the rarity colour; Dust never glows (a glow always means a real pull).
 */
export function CardBack({ rarity = "dust", tease = false, width = 286 }: { rarity?: TierKey; tease?: boolean; width?: number }) {
  const glow = tease && rarity !== "dust";
  const edge = glow ? FINISH[rarity].edge : B.edge;
  const ring = glow ? [...FINISH[rarity].edge, FINISH[rarity].edge[0]] : B.ring;
  const light = glow ? TIERS[rarity].color : B.light;
  const at = `${A.cx}px ${B.cy}px`;
  const streaks = A.streaks.map(([p, tone, a]) => `${tone === "white" ? "#ffffff" : light}${a} ${p * 100}%`).join(", ");
  return (
    <Scaled w={A.w} h={A.h} width={width}>
      <div
        className={`relative h-[408px] w-[286px] rounded-[18px] p-2 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.85)] ${glow ? "tease" : ""}`}
        style={{ ["--rc" as string]: TIERS[rarity].color, background: `linear-gradient(135deg, ${edge.join(", ")})` }}
      >
        <div className="relative h-full overflow-hidden rounded-[11px] text-[#F2EFFA]" style={{ background: `radial-gradient(circle 243px at 50% 44%, ${B.bg[0]} 0%, ${B.bg[1]} 42%, ${B.bg[2]} 75%, ${B.bg[3]} 100%)` }}>
          <div className="absolute inset-0" style={{ background: `repeating-conic-gradient(from 0deg at ${at}, ${light}30 0 3deg, transparent 3deg 12deg)`, ...fade(`radial-gradient(circle at ${at}, #000 18%, transparent 62%)`) }} />
          <div className="absolute inset-0 mix-blend-screen" style={{ background: `linear-gradient(118deg, ${streaks})` }} />
          <div className="absolute inset-0 opacity-50" style={{ background: "radial-gradient(circle, #ffffff55 0 0.5px, transparent 0.9px) 0 0 / 7px 7px", ...fade("linear-gradient(180deg, #000, transparent 55%, #000)") }} />
          {B.rings.map((r, i) => (
            <div key={r} className="absolute rounded-full border" style={{ left: A.cx - r, top: B.cy - r, width: r * 2, height: r * 2, borderColor: light, opacity: 0.3 - i * 0.09 }} />
          ))}
          {/* the medallion: a foil ring around the brand mark */}
          <div className="absolute rounded-full p-[3px]" style={{ left: A.cx - B.medallion, top: B.cy - B.medallion, width: B.medallion * 2, height: B.medallion * 2, background: `conic-gradient(from 210deg, ${ring.join(", ")})`, boxShadow: `0 0 34px -4px ${light}aa` }}>
            <div className="flex h-full items-center justify-center rounded-full" style={{ background: "radial-gradient(circle at 50% 32%, #34265F, #120D28 68%, #0B0818)", boxShadow: "inset 0 0 0 5px #0B0818, inset 0 0 0 6px #ffffff22" }}>
              <div style={{ filter: `drop-shadow(0 3px 0 #05030C) drop-shadow(0 0 16px ${light}99)` }}>
                <LogoMark size={92} />
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 mix-blend-color-dodge" style={{ background: `linear-gradient(125deg, ${A.holo.map(([p, color]) => `${color} ${p * 100}%`).join(", ")})`, opacity: 0.2 }} />
          <div className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-60" style={{ background: "linear-gradient(121deg, #fff0 22%, #ffffffaa 31%, #fff0 42%)" }} />
          <div className="pointer-events-none absolute inset-[9px] rounded-[6px] border border-white/15" />
          {[[16, 16], [246, 16], [16, 368], [246, 368]].map(([x, y]) => (
            <span key={`${x}-${y}`} className="absolute size-[7px] rotate-45" style={{ left: x, top: y, background: light }} />
          ))}
          <div className="num absolute inset-x-0 top-[24px] text-center text-[9px] uppercase tracking-[4.5px] text-[#C9C2E6]">Series 01</div>
          <div className="absolute inset-x-0 top-[298px] flex justify-center" style={{ filter: "drop-shadow(0 3px 8px #000a)" }}>
            <Wordmark className="text-[36px]" />
          </div>
          <div className="num absolute inset-x-0 bottom-[22px] text-center text-[8.5px] uppercase tracking-[2.5px] text-[#A9A3BC]">{B.foot}</div>
        </div>
      </div>
    </Scaled>
  );
}

/** The face-up card: foil art in the company's colours; frame, foil and effects come from the rarity (see FINISH). */
export function HoloCard({ feed, rarity, mult, usd, shares, now, serial, tilt = 0.35, width = 286 }: CardFace & { width?: number }) {
  const f = FINISH[rarity];
  const t = TIERS[rarity];
  const look = STOCK_LOOK[feed];
  const c = look.card;
  const gold = rarity === "grail";
  const dust = rarity === "dust";
  const ink = gold ? "#FFD84D" : "#FFFFFF";
  const at = `${A.cx}px ${A.cy}px`;
  const streaks = A.streaks.map(([p, tone, a]) => `${tone === "white" ? "#ffffff" : look.glow}${a} ${p * 100}%`).join(", ");
  const sheen = 22 + Math.round((tilt - 0.35) * 40);
  return (
    <Scaled w={A.w} h={A.h} width={width}>
      <div
        className="relative h-[408px] w-[286px] rounded-[18px] p-2"
        style={{ background: `linear-gradient(135deg, ${f.edge.join(", ")})`, boxShadow: `${f.glow ? `0 0 34px -6px ${t.color}88, ` : ""}0 30px 60px -24px rgba(0,0,0,0.85)` }}
      >
        <div className="relative h-full overflow-hidden rounded-[11px]" style={{ background: c.panel, color: "#F2EFFA", boxShadow: gold ? "inset 0 0 0 1.5px #FFD84DBB" : undefined }}>
          <div className="absolute inset-0" style={{ filter: dust ? "grayscale(1) brightness(0.78) contrast(0.9)" : f.saturation < 1 ? `saturate(${f.saturation})` : undefined }}>
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle 243px at 50% 40%, ${c.bg[0]} 0%, ${c.bg[1]} 42%, ${c.bg[2]} 75%, ${c.bg[3]} 100%)` }} />
            <BrandMark feed={feed} size={A.mark.size} flat style={{ left: A.mark.x, top: c.mark.y, opacity: c.mark.alpha, filter: "saturate(0.6) brightness(1.7)", ...fade("linear-gradient(180deg, #000 12%, transparent 62%)") }} />
            {f.rays && (
              <div
                className="absolute inset-0"
                style={{ background: `radial-gradient(circle at ${at}, #ffd84d88 0, #ffd84d22 28%, transparent 55%), repeating-conic-gradient(from 0deg at ${at}, #ffe98a40 0 5deg, transparent 5deg 15deg)`, ...fade(`radial-gradient(circle at ${at}, #000 20%, transparent 68%)`) }}
              />
            )}
            <div className="absolute inset-0 mix-blend-screen" style={{ background: `linear-gradient(118deg, ${streaks})` }} />
            <div className="absolute inset-0 opacity-50" style={{ background: "radial-gradient(circle, #ffffff55 0 0.5px, transparent 0.9px) 0 0 / 7px 7px", ...fade("linear-gradient(180deg, #000, transparent 55%, #000)") }} />
            {[103, 131].map((r, i) => (
              <div key={r} className="absolute rounded-full border" style={{ left: A.cx - r, top: A.cy - r, width: r * 2, height: r * 2, borderColor: c.soft, opacity: i ? 0.13 : 0.28 }} />
            ))}
            <div className="absolute left-[45px] top-[228px] h-[26px] w-[180px] rounded-full blur-[3px]" style={{ background: `radial-gradient(closest-side, ${look.glow}cc, ${look.glow}00)` }} />
            <BrandMark feed={feed} size={c.size} style={{ left: A.cx - c.size / 2, top: A.cy - c.size / 2, filter: `drop-shadow(0 0 22px ${look.glow}99) drop-shadow(0 10px 10px #0008)` }} />
          </div>

          {f.holo > 0 && (
            <>
              <div className="pointer-events-none absolute inset-0 mix-blend-color-dodge" style={{ background: `linear-gradient(125deg, ${A.holo.map(([p, color]) => `${color} ${p * 100}%`).join(", ")})`, opacity: f.holo * 0.34 }} />
              <div className="pointer-events-none absolute inset-0 mix-blend-overlay" style={{ background: `linear-gradient(121deg, #fff0 ${sheen}%, #ffffffaa ${sheen + 9}%, #fff0 ${sheen + 20}%)`, opacity: f.holo }} />
            </>
          )}
          {f.sparkle &&
            SPARKLES.map((p, i) => (
              <svg key={i} aria-hidden="true" className="tw absolute" width={p.r * 2} height={p.r * 2} viewBox="0 0 20 20" style={{ left: p.x - p.r, top: p.y - p.r, animationDuration: `${1.6 + (i % 4) * 0.5}s`, animationDelay: `${-i * 0.45}s` }}>
                <path d="M10 0 C11 7 13 9 20 10 C13 11 11 13 10 20 C9 13 7 11 0 10 C7 9 9 7 10 0 Z" fill={p.color} />
              </svg>
            ))}

          <div className="absolute left-[13px] right-[11px] top-[11px] flex items-start justify-between">
            <div>
              <div className="text-[28px] font-extrabold leading-[26px] tracking-[-0.5px]" style={{ color: ink, textShadow: "0 2px 8px #0009" }}>{look.symbol}</div>
              <div className="num mt-1 text-[9px] uppercase tracking-[4.5px]" style={{ color: c.caption }}>{look.company}</div>
            </div>
            <span
              className="num flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.6px]"
              style={dust ? { color: "#B4AEC6", borderColor: "#5A546E", background: "#0D0B14AA" } : { background: t.color, borderColor: t.color, color: "#0D0B14" }}
            >
              <Gem fill={dust ? t.color : "#0D0B14"} size={11} />
              {t.label}
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 border-t px-[13px] py-2 backdrop-blur-[10px]" style={{ top: A.panelY, borderColor: `${t.color}66`, background: `linear-gradient(180deg, ${c.panel}b8, ${c.panel}f2)` }}>
            <div className="flex items-baseline justify-between">
              <span className="text-[50px] font-extrabold leading-[50px] tracking-[-2px]" style={{ color: dust ? "#C9C2D8" : ink }}>{mult}</span>
              <span className="text-xl font-bold">{usd}</span>
            </div>
            <div className="num mt-[3px] flex justify-between text-[10.5px] text-[#E4DFF2]">
              <span>{shares}</span>
              <span style={{ color: now?.includes("\u25bc") ? "#FF8A7A" : dust ? "#C9C2D8" : "#9DF3FF" }}>{now}</span>
            </div>
            <div className="num mt-[7px] flex justify-between border-t border-white/15 pt-1.5 text-[8.5px] uppercase tracking-[0.8px] text-[#A9A3BC]">
              <span>Series 01 · {look.company}</span>
              <span>№ {serial}</span>
            </div>
          </div>
        </div>
      </div>
    </Scaled>
  );
}
