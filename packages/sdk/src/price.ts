/** Rescale `price × 10^expo` to a JS number of USD (display only; the program uses fixed point). */
export function priceToUsd(price: bigint | number, expo: number): number {
  return Number(price) * 10 ** expo;
}

export function isStale(publishTs: number, maxStalenessS: number, nowS = Math.floor(Date.now() / 1000)): boolean {
  return nowS - publishTs > maxStalenessS;
}

/** 1e8 fixed point (what `buy_card.max_price` takes) from USD, with a slippage cushion in bps. */
export function maxPriceE8(usd: number, slippageBps = 100): bigint {
  return BigInt(Math.ceil(usd * 1e8 * (1 + slippageBps / 10_000)));
}
