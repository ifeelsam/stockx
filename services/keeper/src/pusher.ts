import { PublicKey } from "@solana/web3.js";
import { feedPda, pushPriceIx, type ScratchersProgram } from "@scratchers/sdk";
import type { Connection, Keypair } from "@solana/web3.js";
import { log } from "./log.js";
import { isUsMarketOpen, planWalk, type PriceSource } from "./prices.js";
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
        const onChain = prev?.price ?? (await readOnChain(program, rollup, id));
        const steps = planWalk(onChain, q.price, maxMove);
        let ts = Math.max((prev?.publishTs ?? 0) + 1, 1);
        for (let i = 0; i < steps.length; i++) {
          const last = i === steps.length - 1;
          // Intermediate steps carry a stale ts so buys stay paused until the fresh final step lands.
          const publishTs = last ? Math.max(q.publishTs, ts) : ts++;
          await sendIx(rollup, keeper, [await pushPriceIx(program, keeper.publicKey, id, steps[i], last ? q.conf : 0n, publishTs)], { confirm: !last || steps.length > 1 });
        }
        lastPush.set(q.feed, { price: q.price, publishTs: Math.max(q.publishTs, ts), at: Date.now() });
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

async function readOnChain(program: ScratchersProgram, rollup: Connection, id: Uint8Array): Promise<bigint> {
  const info = await rollup.getAccountInfo(feedPda(id), "confirmed");
  if (!info) return 0n;
  const f = program.coder.accounts.decode("priceFeed", info.data);
  return BigInt(f.price.toString());
}
export { PublicKey };
