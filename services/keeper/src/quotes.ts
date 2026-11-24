import { PublicKey, type Connection, type Keypair } from "@solana/web3.js";
import { ackSoldIx, fetchSellQuote, setSellQuoteIx, syncInventoryIx, type ScratchersProgram } from "@scratchers/sdk";
import type { Deployments } from "./config.js";
import { log } from "./log.js";
import { sendIx } from "./tx.js";

const MAX_FEED_AGE_S = 30;

/** What to do with one feed reading: post it as the sell quote, or skip. Pure so it is unit-tested. */
export function planQuote(feed: { price: bigint; publishTs: number }, quote: { ts: number; priceE8: bigint }, nowS: number): "post" | "skip" {
  if (feed.price <= 0n) return "skip";
  if (nowS - feed.publishTs > MAX_FEED_AGE_S) return "skip"; // market closed / relay down: let the quote go stale
  if (feed.publishTs <= quote.ts) return "skip";
  return "post";
}

/**
 * Base-layer sell quotes follow the rollup feeds (the vault sells at the same validated price).
 * Also credits shares sold into the vault to the rollup inventory mirror: ack on base first, then
 * sync on the rollup, so a crash in between under-counts inventory rather than double-counting.
 */
export function startQuotes(o: { program: ScratchersProgram; base: Connection; rollup: Connection; keeper: Keypair; deployments: Deployments }) {
  const { program, base, rollup, keeper, deployments } = o;
  async function tick() {
    for (const [stock, mintStr] of Object.entries(deployments.mints)) {
      const feedConf = deployments.feeds[stock];
      if (!feedConf) continue; // mUSDC
      const mint = new PublicKey(mintStr);
      try {
        const info = await rollup.getAccountInfo(new PublicKey(feedConf.pda), "confirmed");
        const quote = await fetchSellQuote(program, mint).catch(() => null);
        if (!info || !quote) continue;
        const feed = program.coder.accounts.decode("priceFeed", info.data);
        const f = { price: BigInt(feed.price.toString()), publishTs: feed.publishTs.toNumber() };
        if (planQuote(f, quote, Math.floor(Date.now() / 1000)) === "post") {
          await sendIx(base, keeper, [await setSellQuoteIx(program, keeper.publicKey, mint, f.price, f.publishTs)]);
        }
        const unsynced = quote.totalSoldShares - quote.syncedSoldShares;
        if (unsynced > 0n) {
          await sendIx(base, keeper, [await ackSoldIx(program, keeper.publicKey, mint, quote.totalSoldShares)]);
          await sendIx(rollup, keeper, [await syncInventoryIx(program, keeper.publicKey, mint, unsynced)]);
          log("info", "sold shares credited to rollup inventory", { stock, shares: unsynced.toString() });
        }
      } catch (e) {
        log("error", "quote tick failed", { stock, err: (e as Error).message });
      }
    }
  }
  const t = setInterval(tick, 20_000);
  tick();
  return () => clearInterval(t);
}
