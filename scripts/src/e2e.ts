/**
 * Devnet acceptance loop (plan Day 2/3): fresh user → signup → delegate → USDC onto the rollup →
 * session key → buy 10 → 10 VRF reveals → claim_all → shares on Solana.
 * Run AFTER `setup:devnet` (needs deployments/devnet.json) with the deployer funded.
 *
 *   SERIES=3   series to play (default 3 = mSOL, always on)
 */
import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buyCardIx, CardState, fetchStats, fetchSellQuote, sell, signerFrom, claimAllIx, connect, createSessionIx, createStockAtaIx, createTreasuryIx, delegatePlayerIx, depositToRollupIxs,
  depositUsdcIx, fetchPlayer, getProgram, maxPriceE8, playerPda, signupIx, tierFor, topUpActionEscrowIx, treasuryUsdc, DEFAULT_TIERS,
} from "@scratchers/sdk";
import { exists, KEY_DIR, loadOrCreateKey, send, sleep } from "./lib.js";

const dep = JSON.parse(readFileSync(process.env.DEPLOYMENTS ?? join(import.meta.dirname, "../../deployments/devnet.json"), "utf8"));
const seriesId = Number(process.env.SERIES ?? 3);
const series = dep.series.find((s: { id: number }) => s.id === seriesId);
if (!series) throw new Error(`series ${seriesId} not in deployments`);

async function extras(got: bigint) {
  const c = connect({ baseUrl: process.env.RPC_URL });
  const rollup = getProgram(c.rollup), base = getProgram(c.base);
  const st = await fetchStats(rollup, seriesId);
  console.log(`  ✓ Stats on rollup: sold ${st.cardsSold}, tier counts [${st.tierCounts.map((n: { toString(): string }) => n.toString()).join(",")}], shares won ${st.sharesWon}`);
  if (got === 0n || !lastUser) return;
  const stock = new PublicKey(dep.mints[series.stock]), usdc = new PublicKey(dep.mints.mUSDC);
  const q = await fetchSellQuote(base, stock);
  console.log(`  sell quote age ${q.ageS}s (${q.stale ? "STALE" : "fresh"})`);
  if (q.stale) return console.log("  - skipping sell: keeper has not posted a fresh quote");
  const sig = await sell({ program: base, base: c.base, signer: signerFrom(lastUser.publicKey, async (t: any) => (t.partialSign(lastUser), t)), network: "devnet", stockMint: stock, usdcMint: usdc, shares: got });
  const usd = (await getAccount(c.base, getAssociatedTokenAddressSync(usdc, lastUser.publicKey))).amount;
  console.log(`  ✓ sold ${got} share-units to the vault (${sig.slice(0, 12)}…); base USDC now ${usd} (e6)`);
}
let lastUser: Keypair | null = null;

async function main() {
  const c = connect({ baseUrl: process.env.RPC_URL });
  const base = getProgram(c.base), rollup = getProgram(c.rollup);
  const admin = loadOrCreateKey(join(KEY_DIR, "deployer.json"));
  const [usdc, stock] = [new PublicKey(dep.mints.mUSDC), new PublicKey(dep.mints[series.stock])];
  const feed = new PublicKey(dep.feeds[series.stock].pda);
  const user = Keypair.generate(), session = Keypair.generate();
  lastUser = user;
  console.log(`user ${user.publicKey.toBase58()}  series ${seriesId} (${series.stock})  rollup ${c.rollup.rpcEndpoint}`);

  // 1. fund: SOL for fees/rent, 50 mock USDC (deployer is the mint authority)
  const userUsdc = getAssociatedTokenAddressSync(usdc, user.publicKey);
  await send(c.base, [
    SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: user.publicKey, lamports: 0.1 * LAMPORTS_PER_SOL }),
    createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, userUsdc, user.publicKey, usdc),
    createMintToInstruction(usdc, userUsdc, admin.publicKey, 50_000_000n),
  ], [admin], "fund user");

  // 2. signup (Player + fee reserve), stock ATA, delegate Player, action-escrow top-up
  await send(c.base, [await signupIx(base, user.publicKey), createStockAtaIx(user.publicKey, user.publicKey, stock)], [user], "signup + stock ata");
  await send(c.base, [await delegatePlayerIx(base, user.publicKey, c.validator), topUpActionEscrowIx(user.publicKey, playerPda(user.publicKey), 10_000_000n)], [user], "delegate player + escrow top-up");

  // 3. USDC → rollup (eSPL), treasury (one-time), in-app balance
  await send(c.base, await depositToRollupIxs(user.publicKey, usdc, 50_000_000n, c.validator, user.publicKey), [user], "delegateSpl 50 mUSDC");
  for (let i = 0; i < 30 && !(await exists(c.rollup, userUsdc)); i++) await sleep(1000); // wait for the clone
  if (!(await exists(c.rollup, treasuryUsdc(usdc)))) await send(c.rollup, [createTreasuryIx(admin.publicKey, usdc)], [admin], "create treasury (Magic ATA)");
  await send(c.rollup, [await depositUsdcIx(rollup, user.publicKey, usdc, 50_000_000n)], [user], "deposit_usdc 50");

  // 4. session key (cap $20, 1 h), then buy 10 signed by it only
  await send(c.rollup, [await createSessionIx(rollup, user.publicKey, session.publicKey, Math.floor(Date.now() / 1000) + 3600, 20_000_000n)], [user], "create_session");
  const callerSeed = crypto.getRandomValues(new Uint8Array(32));
  const price = await rollup.account.priceFeed.fetch(feed, "confirmed");
  await send(c.rollup, [await buyCardIx(rollup, { signer: session.publicKey, authority: user.publicKey, seriesId, stockMint: stock, feed, n: 10, maxPrice: maxPriceE8(Number(price.price) / 1e8, 200), callerSeed })], [session], "buy_card x10 (session key)");

  // 5. wait for 10 VRF reveals
  const t0 = Date.now();
  let cards: Awaited<ReturnType<typeof fetchPlayer>>["cards"] = [];
  while (Date.now() - t0 < 150_000) {
    cards = (await fetchPlayer(rollup, user.publicKey)).cards;
    const pending = cards.filter((x) => x.state === CardState.RandomnessPending).length;
    process.stdout.write(`\r  pending ${pending}  revealed ${cards.filter((x) => x.state === CardState.Revealed).length}   `);
    if (pending === 0) break;
    await sleep(1500);
  }
  const revealed = cards.filter((x) => x.state === CardState.Revealed);
  console.log(`\n  ${revealed.length} reveals in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (revealed.length !== 10) throw new Error("expected 10 VRF reveals");
  for (const k of revealed) if (k.tier !== tierFor(Uint8Array.from(k.seed), DEFAULT_TIERS)) throw new Error(`card ${k.id}: tier not recomputable from seed`);
  console.log("  ✓ every tier recomputes from its seed");

  // 6. claim (commit + Magic Action) and check shares landed on Solana
  const wins = revealed.filter((k) => BigInt(k.shares.toString()) > 0n);
  await send(c.rollup, [await claimAllIx(rollup, session.publicKey, user.publicKey, seriesId, stock, c.validator)], [session], `claim_all (${wins.length} winning cards)`);
  const stockAta = getAssociatedTokenAddressSync(stock, user.publicKey);
  const want = wins.reduce((a, k) => a + BigInt(k.shares.toString()), 0n);
  for (let i = 0; i < 60; i++) {
    const got = (await getAccount(c.base, stockAta).catch(() => null))?.amount ?? 0n;
    if (got >= want) {
      console.log(`  ✓ ${got} share-units arrived on Solana (expected ${want})`);
      await extras(got);
      return console.log("  E2E OK");
    }
    await sleep(2000);
  }
  console.log("  ✗ shares did not arrive: dropped Magic Action? The keeper's pay_out repair should land them; check keeper logs.");
  process.exit(2);
}
main().catch((e) => { console.error(e); process.exit(1); });
