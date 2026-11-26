/**
 * Devnet only: set a feed by hand when the price source cannot serve it. The keeper must hold that feed
 * (KEEPER_HOLD_FEEDS) to keep the value fresh. Walks there in steps inside the on-chain price band.
 *
 *   pnpm --filter @scratchers/scripts set-price mNVDA 146.95
 */
import { feedPda, getProgram, connect, pushPriceIx } from "@scratchers/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KEY_DIR, loadOrCreateKey, send } from "./lib.js";

const dep = JSON.parse(readFileSync(join(import.meta.dirname, "../../deployments/devnet.json"), "utf8"));
const [name, usd] = process.argv.slice(2);
const conf = dep.feeds[name];
const target = BigInt(Math.round(Number(usd) * 1e8));
if (!conf || !(target > 0n)) throw new Error(`usage: set-price <${Object.keys(dep.feeds).join("|")}> <usd>`);

const c = connect({ baseUrl: process.env.RPC_URL }), rollup = getProgram(c.rollup);
const keeper = loadOrCreateKey(join(KEY_DIR, "keeper.json"));
const id = Uint8Array.from(Buffer.from(conf.id, "hex"));
// re-read every step: a running keeper may push in between
for (let i = 0; i < 60; i++) {
  const f = await rollup.account.priceFeed.fetch(feedPda(id), "confirmed");
  const price = BigInt(f.price.toString());
  if (price === target) break;
  const max = (price * 490n) / 10_000n; // the feeds' band is 5%
  const next = price === 0n || (target > price ? target - price : price - target) <= max ? target : target > price ? price + max : price - max;
  const ts = Math.max(f.publishTs.toNumber() + 1, Math.floor(Date.now() / 1000));
  await send(c.rollup, [await pushPriceIx(rollup, keeper.publicKey, id, next, 0n, ts)], [keeper], `${name} → $${Number(next) / 1e8}`);
}
const end = await rollup.account.priceFeed.fetch(feedPda(id), "confirmed");
console.log(`${name} on the rollup: $${Number(end.price) / 1e8}`);
if (BigInt(end.price.toString()) !== target) process.exit(2);
