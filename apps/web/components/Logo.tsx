import { useId } from "react";
import { colors, LOGO } from "@scratchers/ui-tokens";

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

export const Wordmark = ({ className = "" }: { className?: string }) => (
  <span className={`font-extrabold lowercase leading-none tracking-[-0.05em] ${className}`}>
    <span className="text-accent">rip</span>stokx
  </span>
);
