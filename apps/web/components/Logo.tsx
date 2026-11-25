import { useId } from "react";
import { colors, LOGO, WORDMARK } from "@scratchers/ui-tokens";

export function LogoMark({ size = 32 }: { size?: number }) {
  const id = useId();
  return (
    <svg aria-hidden="true" width={size * LOGO.ratio} height={size} viewBox={LOGO.viewBox}>
      <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor={LOGO.holo[0]} />
        <stop offset="0.48" stopColor={LOGO.holo[1]} />
        <stop offset="1" stopColor={LOGO.holo[2]} />
      </linearGradient>
      <path d={LOGO.top} fill={colors.text} />
      <path d={LOGO.bottom} fill={`url(#${id})`} />
    </svg>
  );
}

/** Sized like text: its height follows the font size set through `className`. */
export function Wordmark({ className = "" }: { className?: string }) {
  const id = useId();
  return (
    <svg role="img" aria-label="ripStokx" className={className} style={{ height: `${WORDMARK.h}em`, width: `${WORDMARK.w}em` }} viewBox={WORDMARK.viewBox}>
      <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={WORDMARK.ripX[0]} y1="0" x2={WORDMARK.ripX[1]} y2="0">
        <stop offset="0" stopColor={WORDMARK.rainbow[0]} />
        <stop offset="0.55" stopColor={WORDMARK.rainbow[1]} />
        <stop offset="1" stopColor={WORDMARK.rainbow[2]} />
      </linearGradient>
      <path d={WORDMARK.rip} fill={`url(#${id})`} />
      <path d={WORDMARK.stokx} fill={colors.accent} />
    </svg>
  );
}
