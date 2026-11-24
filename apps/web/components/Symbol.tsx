import { SYMBOL_PATHS as P } from "@scratchers/ui-tokens";


export function Symbol({ name, color = "currentColor", size = 40, glow = false }: { name: string; color?: string; size?: number; glow?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={glow ? { filter: `drop-shadow(0 0 8px ${color})` } : undefined} aria-label={name}>
      <path d={P[name] ?? P.coin} />
    </svg>
  );
}
