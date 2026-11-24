/** Mirrors the program: spread taken on sells, quote TTL. Keep in sync with state.rs. */
export const SELL_SPREAD_BPS = 50n;
export const SELL_QUOTE_TTL_S = 90;

/** USDC (1e-6) paid for `shares` (1e-6 units) at `priceE8`, less the spread. Floors, like `usdc_for_sale`. */
export function usdcForSale(shares: bigint, priceE8: bigint): bigint {
  return (((shares * priceE8) / 100_000_000n) * (10_000n - SELL_SPREAD_BPS)) / 10_000n;
}
