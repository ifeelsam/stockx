import { PublicKey } from "@solana/web3.js";
import { feedPda, pushPriceIx, type ScratchersProgram } from "@scratchers/sdk";
import type { Connection, Keypair } from "@solana/web3.js";
import { log } from "./log.js";
import { isUsMarketOpen, planWalk, shouldHold, type PriceSource } from "./prices.js";
import { sendIx } from "./tx.js";

export type FeedConf = { name: string; idHex: string };
export const lastPush = new Map<string, { price: bigint; publishTs: number; at: number }>();

/** Hermes (or dev) → push_price on the rollup. ~400 ms during US market hours, 5 s otherwise. */
export function startPusher(o: { program: ScratchersProgram; rollup: Connection; keeper: Keypair; source: PriceSource; feeds: FeedConf[]; maxMoveBps?: number }) {
  const { program, rollup, keeper, source, feeds } = o;
  const maxMove = o.maxMoveBps ?? 500;
  const idByName = Object.fromEntries(feeds.map((f) => [f.name, f.idHex]));
  let stopped = false;
  let lastErr = 0;

  async function tick() {
    try {
      for (const q of await source.fetch(idByName)) {
        const prev = lastPush.get(q.feed);
        if (prev && q.publishTs <= prev.publishTs) continue; // nothing new (market closed / same tick)
        const id = Uint8Array.from(Buffer.from(idByName[q.feed], "hex"));
        // after a restart `prev` is unknown: continue from the on-chain price AND timestamp (push_price needs a strictly newer ts)
        const chain = prev ? { price: prev.price, ts: prev.publishTs } : await readOnChain(program, rollup, id);
        const steps = planWalk(chain.price, q.price, maxMove);
        let ts = Math.max(chain.ts + 1, 1);
        for (let i = 0; i < steps.length; i++) {
          const last = i === steps.length - 1;
          // Intermediate steps carry a stale ts so buys stay paused until the fresh final step lands.
          const publishTs = last ? Math.max(q.publishTs, ts) : ts++;
          await sendIx(rollup, keeper, [await pushPriceIx(program, keeper.publicKey, id, steps[i], last ? q.conf : 0n, publishTs)], { confirm: !last || steps.length > 1 });
        }
        lastPush.set(q.feed, { price: q.price, publishTs: Math.max(q.publishTs, ts), at: Date.now() });
      }
      // Source had nothing new for a feed (market closed): keep the last known price fresh instead of pausing.
      for (const f of feeds) {
        if (!shouldHold(f.name, lastPush.get(f.name)?.at, Date.now(), source.unavailable?.() ?? new Set())) continue;
        const id = Uint8Array.from(Buffer.from(f.idHex, "hex"));
        const prev = lastPush.get(f.name);
        const chain = prev ? { price: prev.price, ts: prev.publishTs } : await readOnChain(program, rollup, id);
        if (chain.price <= 0n) continue;
        const ts = Math.max(chain.ts + 1, Math.floor(Date.now() / 1000));
        await sendIx(rollup, keeper, [await pushPriceIx(program, keeper.publicKey, id, chain.price, 0n, ts)]);
        if (!prev) log("info", "source has no new data: holding last price fresh", { feed: f.name });
        lastPush.set(f.name, { price: chain.price, publishTs: ts, at: Date.now() });
      }
    } catch (e) {
      if (Date.now() - lastErr > 10_000) { lastErr = Date.now(); log("error", "price push failed", { source: source.name, err: (e as Error).message }); }
    }
  }
  (async () => {
    while (!stopped) {
      await tick();
      await new Promise((r) => setTimeout(r, isUsMarketOpen() ? 400 : 5000));
    }
  })();
  log("info", "price pusher started", { source: source.name, feeds: feeds.map((f) => f.name) });
  return () => { stopped = true; };
}

async function readOnChain(program: ScratchersProgram, rollup: Connection, id: Uint8Array): Promise<{ price: bigint; ts: number }> {
  const info = await rollup.getAccountInfo(feedPda(id), "confirmed");
  if (!info) return { price: 0n, ts: 0 };
  const f = program.coder.accounts.decode("priceFeed", info.data);
  return { price: BigInt(f.price.toString()), ts: f.publishTs.toNumber() };
}
export { PublicKey };
