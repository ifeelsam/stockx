import { STOCK_LOOK, type Feed } from "@scratchers/ui-tokens";
import nvda from "../../../packages/ui-tokens/art/nvda.png";
import sol from "../../../packages/ui-tokens/art/sol.png";
import tsla from "../../../packages/ui-tokens/art/tsla.png";
import { Gem } from "./HoloCard";
import { Scaled } from "./Scaled";

const ART = { TSLA: tsla.src, NVDA: nvda.src, SOL: sol.src };

/** The foil pack: rendered art, with what changes (card count, demo odds, paused price) drawn on top. */
export function HoloPack({ feed, count = 10, demo = false, paused = false, width = 220 }: { feed: Feed; count?: number; demo?: boolean; paused?: boolean; width?: number }) {
  const p = STOCK_LOOK[feed];
  const seal = "num absolute top-[12px] text-[8px] font-bold leading-[11px] tracking-[1px]";
  return (
    <Scaled w={220} h={330} width={width}>
      <div className="relative h-[330px] w-[220px] text-text">
        <div aria-hidden="true" className="absolute -inset-x-1 -bottom-5 h-10" style={{ background: `radial-gradient(ellipse at center, ${p.glow}66, transparent 70%)` }} />
        <img src={ART[feed]} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" style={{ filter: `drop-shadow(0 12px 22px ${p.glow}40)` }} />
        <span className={`${seal} left-[30px]`} style={{ color: p.foilInk }}>SERIES 01 · {count} CARD{count > 1 ? "S" : ""}</span>
        <span className={`${seal} right-[22px]`} style={{ color: p.foilInk }}>TEAR ▸</span>
        {/* covers the printed Grail line: demo odds must never look like the real ones */}
        {demo && (
          <div className="num absolute left-[39px] top-[246px] flex h-[31px] w-[142px] items-center justify-center gap-1.5 rounded-full border border-gold bg-[#0D0B14] text-[11px] font-bold text-gold">
            <Gem fill="#FFD84D" size={10} />
            DEMO ODDS
          </div>
        )}
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
