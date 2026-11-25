import { FINISH, STOCK_LOOK, TIERS, type TierKey } from "@scratchers/ui-tokens";
import { Scaled } from "./Scaled";

export type Feed = keyof typeof STOCK_LOOK;
export type CardFace = {
  feed: Feed;
  rarity: TierKey;
  mult: string;
  usd: string;
  shares: string;
  now?: string;
  serial: string;
  /** 0..1: angle of the holo sweep (derived from the seed for real cards) */
  tilt?: number;
};

const HOLO = (a: number) => `conic-gradient(from ${Math.round(a * 360)}deg at ${Math.round(a * 100)}% 40%, #ff6ec7, #7afcff, #feff9c, #b28dff, #ff6ec7)`;
const FRAME_TEX: Record<TierKey, string> = {
  dust: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.15))",
  common: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.12))",
  uncommon: "repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 6px)",
  rare: "linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 40%, rgba(0,0,0,0.15))",
  epic: "radial-gradient(circle, rgba(255,255,255,0.8) 0 0.8px, transparent 1.2px) 0 0 / 11px 13px, radial-gradient(circle, rgba(157,243,255,0.7) 0 0.6px, transparent 1px) 5px 6px / 17px 19px",
  legend: "repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0 2px, transparent 2px 7px), linear-gradient(180deg, rgba(255,255,255,0.25), rgba(0,0,0,0.2))",
  mythic: "linear-gradient(180deg, rgba(255,255,255,0.2), rgba(0,0,0,0.15))",
  grail: "repeating-linear-gradient(-45deg, rgba(255,255,255,0.18) 0 1px, transparent 1px 5px)",
};
const frameFill = (r: TierKey, a: number) =>
  r === "mythic"
    ? `conic-gradient(from ${Math.round(a * 360)}deg, #ff6ec7, #ffb86b, #feff9c, #7afcff, #b28dff, #ff6ec7)`
    : r === "grail"
      ? "linear-gradient(135deg, #FFF3B0, #FFD84D 30%, #B8860B 55%, #FFE98A 75%, #C99A1A)"
      : FINISH[r].frame;

function Art({ feed }: { feed: Feed }) {
  return (
    <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 246 196" preserveAspectRatio="xMidYMid slice">
      {feed === "TSLA" && (
        <>
          <circle cx="123" cy="150" r="96" fill="#FFB23F" />
          <circle cx="123" cy="150" r="62" fill="#FFE27A" />
          <path d="M0 150 H246 V196 H0 Z" fill="#2B1B5C" />
          <path d="M123 150 L60 196 M123 150 L186 196" stroke="#F2EFFA" strokeWidth="4" />
          <path d="M118 150 L104 196 M128 150 L142 196" stroke="#F2EFFA" strokeWidth="2" strokeDasharray="6 6" />
          <path d="M20 118 L60 92 L86 104 L130 60 L160 78 L206 30" fill="none" stroke="#2B1B5C" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {feed === "NVDA" && (
        <>
          <path d="M0 40 H246 M0 80 H246 M0 120 H246 M0 160 H246 M41 0 V196 M82 0 V196 M123 0 V196 M164 0 V196 M205 0 V196" stroke="#0E5A35" strokeWidth="2" />
          <rect x="82" y="80" width="82" height="80" fill="#0D0B14" />
          <rect x="96" y="94" width="54" height="52" fill="#B8FF5C" />
          <path d="M82 100 H60 M82 140 H40 M164 100 H200 M164 140 H220 M110 80 V50 M136 160 V190" stroke="#B8FF5C" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {feed === "SOL" && (
        <>
          <ellipse cx="123" cy="104" rx="110" ry="34" fill="none" stroke="#F2EFFA" strokeWidth="3" transform="rotate(-14 123 104)" />
          <ellipse cx="123" cy="104" rx="80" ry="22" fill="none" stroke="#FFD84D" strokeWidth="2" strokeDasharray="5 6" transform="rotate(-14 123 104)" />
          <circle cx="123" cy="100" r="40" fill="#FF8AC2" />
          <circle cx="110" cy="88" r="12" fill="#FFC2DF" />
          <circle cx="40" cy="40" r="3" fill="#F2EFFA" />
          <circle cx="210" cy="30" r="2" fill="#F2EFFA" />
          <circle cx="196" cy="170" r="3" fill="#FFD84D" />
        </>
      )}
    </svg>
  );
}

const Gem = ({ fill, size = 14 }: { fill: string; size?: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 14 14">
    <path d="M7 0 L14 7 L7 14 L0 7 Z" fill={fill} stroke="#0D0B14" strokeWidth="1" />
  </svg>
);
export { Gem };

/** Face-down card. `tease` glows in the rarity colour; Dust never glows (a glow always means a real pull). */
export function CardBack({ rarity = "dust", tease = false, width = 286 }: { rarity?: TierKey; tease?: boolean; width?: number }) {
  const glow = tease && rarity !== "dust";
  return (
    <Scaled w={286} h={408} width={width}>
      <div className="relative h-[408px] w-[286px] rounded-[18px] p-[9px] shadow-[0_30px_60px_-24px_rgba(0,0,0,0.85)]" style={{ background: glow ? FINISH[rarity].frame : "#24202F" }}>
        <div
          className={`relative flex h-full flex-col items-center justify-center gap-3.5 rounded-xl ${glow ? "tease" : ""}`}
          style={{
            ["--rc" as string]: TIERS[rarity].color,
            backgroundColor: "#2B1B5C",
            backgroundImage: "repeating-linear-gradient(45deg, rgba(157,243,255,0.10) 0 2px, transparent 2px 22px), repeating-linear-gradient(-45deg, rgba(157,243,255,0.10) 0 2px, transparent 2px 22px)",
          }}
        >
          <svg aria-hidden="true" width="92" height="92" viewBox="0 0 92 92">
            <path d="M46 4 L88 46 L46 88 L4 46 Z" fill="#0D0B14" stroke="#9DF3FF" strokeWidth="3" />
            <path d="M46 22 L70 46 L46 70 L22 46 Z" fill="none" stroke="#9DF3FF" strokeWidth="2" />
            <text x="46" y="53" textAnchor="middle" fontWeight="800" fontSize="20" fill="#F2EFFA">SS</text>
          </svg>
          <span className="num text-[11px] tracking-[2px] text-[#C9C2E6]">STOCK SCRATCHERS</span>
        </div>
      </div>
    </Scaled>
  );
}

/** The face-up card: frame, holo coverage and layout come from the rarity (see FINISH). */
export function HoloCard({ feed, rarity, mult, usd, shares, now, serial, tilt = 0.35, width = 286 }: CardFace & { width?: number }) {
  const f = FINISH[rarity];
  const t = TIERS[rarity];
  const look = STOCK_LOOK[feed];
  const gold = rarity === "grail";
  const ink = f.full ? "#F2EFFA" : "#0D0B14";
  const accentInk = gold ? "#FFD84D" : ink;
  return (
    <Scaled w={286} h={408} width={width}>
      <div className="relative h-[408px] w-[286px] rounded-[18px] p-[9px] shadow-[0_30px_60px_-24px_rgba(0,0,0,0.85)]" style={{ background: frameFill(rarity, tilt) }}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[18px]" style={{ background: FRAME_TEX[rarity] }} />
        <div
          className="relative flex h-full flex-col overflow-hidden rounded-xl"
          style={{ background: f.full ? "#0D0B14" : "#F2EFFA", color: ink, boxShadow: gold ? "inset 0 0 0 1.5px rgba(255,216,77,0.7)" : undefined }}
        >
          <div
            className={`order-2 overflow-hidden ${f.full ? "absolute inset-0" : "relative mx-2.5 h-[196px] rounded-md"}`}
            style={{ background: look.art, filter: rarity === "dust" ? "grayscale(1) contrast(0.85) brightness(1.05)" : rarity === "common" ? "saturate(0.7)" : undefined }}
          >
            <Art feed={feed} />
            <div className="absolute inset-0 mix-blend-color-dodge" style={{ background: HOLO(tilt), opacity: f.holo }} />
            {f.full && <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(13,11,20,0.55) 0%, rgba(13,11,20,0) 22%, rgba(13,11,20,0) 52%, rgba(13,11,20,0.82) 78%, rgba(13,11,20,0.92) 100%)" }} />}
          </div>

          <div className="relative order-1 flex items-center justify-between px-3 py-2.5">
            <span className="text-[26px] font-extrabold tracking-tight" style={{ color: accentInk }}>{look.symbol}</span>
            <span
              className="num flex items-center gap-1.5 rounded-full text-[11px] font-bold uppercase"
              style={f.filledBadge ? { background: t.color, color: "#0D0B14", padding: "3px 8px" } : { color: rarity === "dust" ? "#4E4864" : "#0D0B14" }}
            >
              <Gem fill={f.filledBadge ? "#0D0B14" : t.color} />
              {t.label}
            </span>
          </div>

          <div className={`relative order-3 flex items-baseline justify-between px-3 pt-2.5 ${f.full ? "mt-auto" : ""}`}>
            <span className="text-[54px] font-extrabold leading-[50px] tracking-[-2px]" style={{ color: accentInk }}>{mult}</span>
            <span className="text-lg font-bold">{usd}</span>
          </div>
          <div className="num relative order-4 flex justify-between px-3 pt-1.5 text-[11px]">
            <span>{shares}</span>
            <span>{now}</span>
          </div>
          <div className={`num relative order-5 flex justify-between border-t px-3 py-2 text-[10px] ${f.full ? "" : "mt-auto"}`} style={{ borderColor: f.full ? "rgba(242,239,250,0.22)" : "#D9D4E6", color: f.full ? "#C9C2E6" : "#4E4864" }}>
            <span>Series 01 · {look.company}</span>
            <span>№ {serial}</span>
          </div>

          {f.cardHolo > 0 && <div className="pointer-events-none absolute inset-0 mix-blend-color-dodge" style={{ background: HOLO(tilt), opacity: f.cardHolo }} />}
          {f.holo > 0 && (
            <div
              className="pointer-events-none absolute inset-0 mix-blend-overlay"
              style={{ background: `linear-gradient(${100 + Math.round(tilt * 60)}deg, rgba(255,255,255,0) ${Math.round(tilt * 60)}%, rgba(255,255,255,0.6) ${Math.round(tilt * 60 + 8)}%, rgba(255,255,255,0) ${Math.round(tilt * 60 + 18)}%)` }}
            />
          )}
          {f.sparkle && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              {Array.from({ length: 7 }, (_, i) => (
                <svg key={i} className="tw absolute" width={8 + (i % 3) * 5} height={8 + (i % 3) * 5} viewBox="0 0 20 20" style={{ left: (i * 71 + 23) % 240, top: (i * 97 + 30) % 340, animationDuration: `${1.6 + (i % 4) * 0.5}s`, animationDelay: `${-i * 0.45}s` }}>
                  <path d="M10 0 C11 7 13 9 20 10 C13 11 11 13 10 20 C9 13 7 11 0 10 C7 9 9 7 10 0 Z" fill={["#FFFFFF", "#FFE98A", "#FFD84D"][i % 3]} />
                </svg>
              ))}
            </div>
          )}
        </div>
      </div>
    </Scaled>
  );
}
