import { seriesById, type Prices, type UiCard } from "@scratchers/app-core";
import { change as flat, describeCard } from "@scratchers/ui-tokens";

export { cardUsd, money, oddsText, serialOf } from "@scratchers/ui-tokens";

export const change = (d: number) => {
  const c = flat(d);
  return { text: c.text, cls: c.down ? "text-danger" : "text-accent" };
};

export function cardView(c: UiCard & { art: NonNullable<UiCard["art"]> }, prices: Prices) {
  const series = seriesById(c.seriesId);
  return { series, ...describeCard(c, series, prices[series.feed]) };
}
