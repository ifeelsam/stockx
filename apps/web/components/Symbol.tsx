/** Original 24x24 line glyphs for the 15 panel symbols produced by cardArt. */
const P: Record<string, string> = {
  coin: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 4v10m-2.5-7.5c0-1 1-1.5 2.5-1.5s2.5.5 2.5 1.5-1 1.5-2.5 1.5-2.5.5-2.5 1.5 1 1.5 2.5 1.5 2.5-.5 2.5-1.5",
  bolt: "M13 2L5 14h6l-1 8 8-12h-6z",
  star: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z",
  gem: "M6 4h12l4 6-10 11L2 10zM2 10h20M9 4l-2 6 5 11 5-11-2-6",
  crown: "M3 18h18l1-11-5 4-5-7-5 7-5-4zM3 21h18",
  rocket: "M12 2c3 2 5 6 5 10l-2 4H9l-2-4c0-4 2-8 5-10zM9 16l-3 4 4-1m5-3l3 4-4-1M12 9.5a1.5 1.5 0 100 .01",
  bull: "M3 4c0 4 2 6 5 6m13-6c0 4-2 6-5 6M8 10c-1 3-1 6 1 9h6c2-3 2-6 1-9M10 15h.01M14 15h.01M9.5 19.5c1 1 4 1 5 0",
  leaf: "M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19l9-9",
  moon: "M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z",
  key: "M8 15a4 4 0 110-8 4 4 0 010 8zm3.5-2.5L21 12m-3-.5v3m-3-2.5v3",
  cloud: "M7 18a4 4 0 01-.5-8A5.5 5.5 0 0117 9a4.5 4.5 0 01.5 9z",
  dice: "M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01",
  flame: "M12 22c4 0 7-2.7 7-7 0-4-3-6-4-10-3 2-4 4-4 6-1.5-1-2-2-2-3-2 2-4 4-4 7 0 4.3 3 7 7 7z",
  wave: "M2 9c3-3 5 3 8 0s5 3 8 0 3 0 4 0M2 15c3-3 5 3 8 0s5 3 8 0 3 0 4 0",
  fish: "M3 12c3-5 9-6 14-2l4-3v10l-4-3c-5 4-11 3-14-2zM7.5 11.5h.01",
};

export function Symbol({ name, color = "currentColor", size = 40, glow = false }: { name: string; color?: string; size?: number; glow?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={glow ? { filter: `drop-shadow(0 0 8px ${color})` } : undefined} aria-label={name}>
      <path d={P[name] ?? P.coin} />
    </svg>
  );
}
