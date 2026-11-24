"use client";
import { useEffect, useRef } from "react";
import { createChart, LineSeries, ColorType, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { colors } from "@scratchers/ui-tokens";

/** Live price line fed from rollup price pushes. */
export function Sparkline({ data, height = 140 }: { data: { t: number; v: number }[]; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const series = useRef<ISeriesApi<"Line"> | null>(null);
  useEffect(() => {
    const chart = createChart(el.current!, {
      height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: colors.textDim },
      grid: { vertLines: { visible: false }, horzLines: { color: colors.line } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: true },
      crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
    });
    series.current = chart.addSeries(LineSeries, { color: colors.money, lineWidth: 2, priceLineVisible: false });
    return () => chart.remove();
  }, [height]);
  useEffect(() => {
    // lightweight-charts needs strictly ascending, unique timestamps
    const seen = new Set<number>();
    const pts = data.filter((d) => (seen.has(d.t) ? false : (seen.add(d.t), true))).map((d) => ({ time: d.t as UTCTimestamp, value: d.v }));
    series.current?.setData(pts);
  }, [data]);
  return <div ref={el} className="w-full" />;
}
