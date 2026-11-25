import type { ReactNode } from "react";

/** Draws a fixed-size design (card 286×408, pack 220×330) at any width. */
export function Scaled({ w, h, width, children }: { w: number; h: number; width: number; children: ReactNode }) {
  return (
    <div style={{ width, height: (h * width) / w }}>
      <div style={{ width: w, height: h, transform: `scale(${width / w})`, transformOrigin: "0 0" }}>{children}</div>
    </div>
  );
}
