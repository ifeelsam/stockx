/**
 * Live devnet conformance: the MagicBlock rules in CLAUDE.md §3-§4, checked against the deployed program, the
 * public rollup and the running keeper. Refusals are simulated (no state change); everything else is real.
 *
 *   pnpm --filter @scratchers/scripts conformance:devnet        COMMITS=40 to change the commit-limit run
 */
import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction, type Connection, type TransactionInstruction } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACTION_ESCROW_LAMPORTS, buyCardIx, cancelPendingIx, CardState, claimAllIx, connect, createSessionIx, createStockAtaIx, delegatePlayerIx, depositToRollupIxs, depositUsdcIx,
  feedPda, fetchPlayer, getDelegationStatus, getProgram, maxPriceE8, payOutIx, payoutPda, playerPda, PROGRAM_ID, pushPriceIx, revokeSessionIx, seriesPda, signupIx, statsPda, tierFor,
  PLAYER_RESERVE_LOW_LAMPORTS, topUpActionEscrowIx, topUpPlayerReserveIx, undelegatePlayerIx, waitForRollupUsdc, vaultPda, withdrawFromRollupIxs, withdrawUsdcIx,
} from "@scratchers/sdk";
import idl from "../../packages/sdk/src/generated/scratchers.json" with { type: "json" };
import { KEY_DIR, loadOrCreateKey, send, sleep } from "./lib.js";

const dep = JSON.parse(readFileSync(join(import.meta.dirname, "../../deployments/devnet.json"), "utf8"));
const DLP = "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh";
const ERR = new Map<number, string>((idl.errors as { code: number; name: string }[]).map((e) => [e.code, e.name.toLowerCase()]));
const results: { name: string; ok: boolean; note: string }[] = [];
const record = (name: string, ok: boolean, note = "") => {
  results.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? `  (${note})` : ""}`);
};
const check = async (name: string, f: () => Promise<string | void>) => {
  try { record(name, true, (await f()) ?? ""); } catch (e) { record(name, false, (e as Error).message.split("\n")[0].slice(0, 220)); }
};

/** Simulate and require a specific program error. */
async function refused(conn: Connection, ixs: TransactionInstruction[], signers: Keypair[], want: string) {
  const recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  const tx = new VersionedTransaction(new TransactionMessage({ payerKey: signers[0].publicKey, recentBlockhash, instructions: ixs }).compileToV0Message());
  tx.sign(signers);
  const res = await conn.simulateTransaction(tx);
  const err = res.value.err as { InstructionError?: [number, { Custom?: number }] } | null;
  if (!err) throw new Error(`accepted, expected ${want}`);
  const code = err.InstructionError?.[1]?.Custom;
  const got = (code !== undefined && ERR.get(code)) || JSON.stringify(err);
  if (got !== want.toLowerCase()) throw new Error(`expected ${want}, got ${got}`);
  return `refused with ${want}`;
}

async function until<T>(what: string, f: () => Promise<T | null | false | undefined>, seconds = 90): Promise<T> {
  for (const end = Date.now() + seconds * 1000; Date.now() < end; await sleep(1500)) {
    const v = await f().catch(() => null);
    if (v) return v;
  }
  throw new Error(`timed out after ${seconds}s waiting for ${what}`);
}

async function main() {
  const c = connect({ baseUrl: process.env.RPC_URL });
  const base = getProgram(c.base), rollup = getProgram(c.rollup);
  const admin = loadOrCreateKey(join(KEY_DIR, "deployer.json"));
  const keeper = loadOrCreateKey(join(KEY_DIR, "keeper.json"));
  const seriesId = 13; // SOL: the one series with a live price source
  const stock = new PublicKey(dep.mints.mSOL), usdc = new PublicKey(dep.mints.mUSDC);
  const feed = new PublicKey(dep.feeds.mSOL.pda);
  const user = Keypair.generate(), session = Keypair.generate(), stranger = Keypair.generate();
  const player = playerPda(user.publicKey);
  const userUsdc = getAssociatedTokenAddressSync(usdc, user.publicKey);
  const stockAta = getAssociatedTokenAddressSync(stock, user.publicKey);
  console.log(`test user ${user.publicKey.toBase58()}\n`);

  await send(c.base, [
    SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: user.publicKey, lamports: 0.2 * LAMPORTS_PER_SOL }),
    createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, userUsdc, user.publicKey, usdc),
    createMintToInstruction(usdc, userUsdc, admin.publicKey, 80_000_000n),
  ], [admin], "fund test user");
  await send(c.base, [await signupIx(base, user.publicKey), createStockAtaIx(user.publicKey, user.publicKey, stock)], [user], "signup + stock ATA");
  // deliberately no action-escrow top-up yet: the first claim's Magic Action must be dropped
  await send(c.base, [await delegatePlayerIx(base, user.publicKey, c.validator)], [user], "delegate player");
  await until("player on the rollup", () => c.rollup.getAccountInfo(player));

  console.log("\n-- delegation and routing --");
  for (const [label, key] of [["player", player], ["vault", vaultPda(stock)], ["price feed", feed], ["stats", statsPda(seriesId)]] as const)
    await check(`${label}: delegated, router points at our validator, owners correct`, async () => {
      const s = await until(`router status for ${label}`, async () => { const r = await getDelegationStatus(key, c.routerUrl); return r.isDelegated && r; }, 40);
      if (!s.fqdn || new URL(s.fqdn).host !== new URL(c.rollup.rpcEndpoint).host) throw new Error(`router says ${s.fqdn}`);
      const [b, r] = [await c.base.getAccountInfo(key), await c.rollup.getAccountInfo(key)];
      if (b?.owner.toBase58() !== DLP) throw new Error(`base owner ${b?.owner.toBase58()}`);
      if (!r?.owner.equals(PROGRAM_ID)) throw new Error(`rollup owner ${r?.owner.toBase58()}`);
      return s.fqdn;
    });
  await check("Player fits the 10,240-byte commit limit", async () => {
    const n = (await c.rollup.getAccountInfo(player))!.data.length;
    if (n >= 10_240) throw new Error(`${n} bytes`);
    return `${n} bytes`;
  });

  console.log("\n-- eSPL in and out --");
  await check("delegateSpl: USDC appears on the rollup", async () => {
    await send(c.base, await depositToRollupIxs(c.base, user.publicKey, usdc, 80_000_000n, c.validator, user.publicKey), [user], "delegateSpl 80");
    await waitForRollupUsdc(c.rollup, user.publicKey, usdc, 80_000_000n);
  });
  await check("deposit_usdc credits the Player", async () => {
    await send(c.rollup, [await depositUsdcIx(rollup, user.publicKey, usdc, 80_000_000n)], [user], "deposit_usdc 80");
    const p = await fetchPlayer(rollup, user.publicKey);
    if (p.usdcBalanceE6.toNumber() !== 80_000_000) throw new Error(`balance ${p.usdcBalanceE6}`);
  });

  const buy = async (signer: PublicKey, n: number, o: { max?: bigint; series?: number; stockSym?: "mSOL" | "mTSLA"; feed?: PublicKey } = {}) => {
    const sym = o.stockSym ?? "mSOL";
    const px = await rollup.account.priceFeed.fetch(new PublicKey(dep.feeds[sym].pda), "confirmed");
    return buyCardIx(rollup, { signer, authority: user.publicKey, seriesId: o.series ?? seriesId, stockMint: new PublicKey(dep.mints[sym]), feed: o.feed ?? new PublicKey(dep.feeds[sym].pda), n, maxPrice: o.max ?? maxPriceE8(Number(px.price) / 1e8, 200), callerSeed: crypto.getRandomValues(new Uint8Array(32)) });
  };
  const session_ = async (seconds: number, capE6: bigint) =>
    send(c.rollup, [await createSessionIx(rollup, user.publicKey, session.publicKey, Math.floor(Date.now() / 1000) + seconds, capE6)], [user], `create_session ${seconds}s cap ${capE6}`);

  await check("a second delegateSpl tops up an already-delegated balance", async () => {
    await send(c.base, [createMintToInstruction(usdc, userUsdc, admin.publicKey, 5_000_000n)], [admin], "mint 5 more");
    await send(c.base, await depositToRollupIxs(c.base, user.publicKey, usdc, 5_000_000n, c.validator, user.publicKey), [user], "delegateSpl 5");
    await waitForRollupUsdc(c.rollup, user.publicKey, usdc, 5_000_000n);
    await send(c.rollup, [await depositUsdcIx(rollup, user.publicKey, usdc, 5_000_000n)], [user], "deposit_usdc 5");
  });

  await check("a third top-up also arrives", async () => {
    await send(c.base, [createMintToInstruction(usdc, userUsdc, admin.publicKey, 3_000_000n)], [admin], "mint 3 more");
    await send(c.base, await depositToRollupIxs(c.base, user.publicKey, usdc, 3_000_000n, c.validator, user.publicKey), [user], "delegateSpl 3");
    await waitForRollupUsdc(c.rollup, user.publicKey, usdc, 3_000_000n);
    await send(c.rollup, [await depositUsdcIx(rollup, user.publicKey, usdc, 3_000_000n)], [user], "deposit_usdc 3");
  });

  console.log("\n-- session keys and spend cap --");
  await check("a stranger cannot spend the balance", async () => refused(c.rollup, [await buy(stranger.publicKey, 1)], [stranger], "Unauthorized"));
  await session_(3600, 1_000_000n);
  await check("spend above the session cap is refused", async () => refused(c.rollup, [await buy(session.publicKey, 2)], [session], "SessionCapExceeded"));
  await session_(4, 50_000_000n);
  await sleep(8000);
  await check("an expired session with cap left is refused", async () => refused(c.rollup, [await buy(session.publicKey, 1)], [session], "SessionExpired"));
  await session_(3600, 60_000_000n);
  await send(c.rollup, [await revokeSessionIx(rollup, user.publicKey)], [user], "revoke_session");
  await check("a revoked session is refused", async () => refused(c.rollup, [await buy(session.publicKey, 1)], [session], "Unauthorized"));
  await session_(3600, 70_000_000n);

  console.log("\n-- price rules --");
  await check("price above the buyer's max is refused", async () => refused(c.rollup, [await buy(session.publicKey, 1, { max: 1n })], [session], "PriceAboveMax"));
  await check("another series' feed is refused", async () => refused(c.rollup, [await buy(session.publicKey, 1, { feed: new PublicKey(dep.feeds.mTSLA.pda) })], [session], "WrongFeed"));
  const tsla = await rollup.account.priceFeed.fetch(new PublicKey(dep.feeds.mTSLA.pda), "confirmed");
  const tslaAge = Math.floor(Date.now() / 1000) - tsla.publishTs.toNumber();
  if (tslaAge > 60) await check("a stale price pauses sales", async () => `${await refused(c.rollup, [await buy(session.publicKey, 1, { series: 11, stockSym: "mTSLA" })], [session], "PriceStale")}; TSLA is ${tslaAge}s old`);
  else console.log("SKIP  stale price (TSLA feed is fresh right now)");
  const solId = Uint8Array.from(Buffer.from(dep.feeds.mSOL.id, "hex"));
  const sol = await rollup.account.priceFeed.fetch(feedPda(solId), "confirmed");
  const now = () => Math.floor(Date.now() / 1000);
  await check("only the feed's pusher can push a price", async () => refused(c.rollup, [await pushPriceIx(rollup, stranger.publicKey, solId, BigInt(sol.price.toString()), 0n, now() + 5)], [stranger], "Unauthorized"));
  await check("an older timestamp is refused", async () => refused(c.rollup, [await pushPriceIx(rollup, keeper.publicKey, solId, BigInt(sol.price.toString()), 0n, 1)], [keeper], "PriceStale"));
  await check("a jump beyond the band is refused", async () => refused(c.rollup, [await pushPriceIx(rollup, keeper.publicKey, solId, BigInt(sol.price.toString()) * 2n, 0n, now() + 30)], [keeper], "PriceOutOfBand"));

  console.log("\n-- VRF --");
  await check("cancel_pending before the timeout is refused", async () => {
    const id = BigInt((await fetchPlayer(rollup, user.publicKey)).nextCardId.toString());
    return refused(c.rollup, [await buy(session.publicKey, 1), await cancelPendingIx(rollup, session.publicKey, user.publicKey, seriesId, stock, id)], [session], "NotTimedOut");
  });
  const revealAll = () => until("VRF reveals", async () => { const p = await fetchPlayer(rollup, user.publicKey); return p.cards.every((k) => k.state !== CardState.RandomnessPending) && p; }, 150);
  await check("balance below the cost is refused", async () => {
    const most = BigInt((await fetchPlayer(rollup, user.publicKey)).usdcBalanceE6.toString()) - 500_000n; // leave $0.50
    await send(c.rollup, [await withdrawUsdcIx(rollup, user.publicKey, usdc, most)], [user], "withdraw_usdc all but 0.50");
    try {
      return await refused(c.rollup, [await buy(session.publicKey, 1)], [session], "InsufficientBalance");
    } finally {
      await send(c.rollup, [await depositUsdcIx(rollup, user.publicKey, usdc, most)], [user], "deposit_usdc back");
    }
  });
  let bought: Awaited<ReturnType<typeof fetchPlayer>>["cards"] = [];
  await check("buy 8 signed by the session key → 8 VRF reveals", async () => {
    await send(c.rollup, [await buy(session.publicKey, 8)], [session], "buy_card x8");
    const t0 = Date.now();
    bought = (await revealAll()).cards.filter((k) => k.state === CardState.Revealed);
    if (bought.length !== 8) throw new Error(`${bought.length} revealed`);
    return `${((Date.now() - t0) / 1000).toFixed(1)}s`;
  });
  await check("every rarity recomputes from its seed", async () => {
    const tiers = (await base.account.series.fetch(seriesPda(seriesId))).tiers;
    for (const k of bought) if (k.tier !== tierFor(Uint8Array.from(k.seed), tiers)) throw new Error(`card ${k.id}`);
  });

  console.log("\n-- Magic Action dropped on purpose, keeper repairs --");
  const claim = async () => send(c.rollup, [await claimAllIx(rollup, session.publicKey, user.publicKey, seriesId, stock, c.validator)], [session], "claim_all");
  const payouts = bought.map((k) => payoutPda(player, BigInt(k.id.toString())));
  const owed = bought.reduce((a, k) => a + BigInt(k.shares.toString()), 0n);
  const balance = async () => (await getAccount(c.base, stockAta, "confirmed").catch(() => null))?.amount ?? 0n;
  await check("claim_all commits even though its actions cannot pay (empty escrow)", async () => {
    await claim();
    await until("committed ClaimRequested on Solana", async () => { const i = await c.base.getAccountInfo(player); return i && (base.coder.accounts.decode("player", i.data).cards as { state: number }[]).filter((k) => k.state === CardState.ClaimRequested).length === 8; });
    if ((await c.base.getAccountInfo(payouts[0])) !== null) throw new Error("a payout already exists: the action was not dropped");
  });
  await check("the running keeper pays every dropped card", async () => {
    const t0 = Date.now();
    await until("8 payouts", async () => (await c.base.getMultipleAccountsInfo(payouts)).every((a) => a !== null), 180);
    await until("shares", async () => (await balance()) >= owed, 30);
    return `${((Date.now() - t0) / 1000).toFixed(0)}s, ${owed} share-units`;
  });
  await check("paid exactly once: a second pay_out is refused", async () => {
    if ((await balance()) !== owed) throw new Error(`holds ${await balance()}, owed ${owed}`);
    return refused(c.base, [await payOutIx(base, keeper.publicKey, user.publicKey, seriesId, stock, BigInt(bought[0].id.toString()))], [keeper], "AlreadyPaid");
  });
  await check("keeper frees the slots (mark_settled)", async () => {
    await until("settled slots", async () => (await fetchPlayer(rollup, user.publicKey)).cards.every((k) => k.state !== CardState.ClaimRequested), 90);
  });

  console.log("\n-- commit limit with the fee vault --");
  await send(c.base, [topUpActionEscrowIx(user.publicKey, player, ACTION_ESCROW_LAMPORTS)], [user], "top up action escrow");
  const target = Number(process.env.COMMITS ?? 40);
  let commits = 1, failure = "", viaAction = 0;
  const start = await c.rollup.getBalance(player);
  const rent = await c.base.getMinimumBalanceForRentExemption((await c.rollup.getAccountInfo(player))!.data.length);
  let toppedUpAt = 0;
  for (; commits < target; commits++) {
    try {
      const before = await c.rollup.getBalance(player);
      if (before - rent < PLAYER_RESERVE_LOW_LAMPORTS) {
        await send(c.base, [topUpPlayerReserveIx(user.publicKey, user.publicKey)], [user], "top up commit reserve");
        await until("reserve on the rollup", async () => (await c.rollup.getBalance(player)) > before, 60);
        toppedUpAt = commits;
      }
      await send(c.rollup, [await buy(session.publicKey, 1)], [session], `buy (commit ${commits + 1})`);
      const k = (await revealAll()).cards.find((x) => x.state === CardState.Revealed)!;
      const pda = payoutPda(player, BigInt(k.id.toString()));
      await claim();
      if (commits <= 3) { await sleep(6000); if (await c.base.getAccountInfo(pda)) viaAction++; }
    } catch (e) { failure = (e as Error).message.replace(/\s+/g, " ").slice(0, 200); break; }
  }
  const lamports = await c.rollup.getBalance(player);
  record("funded escrow: the Magic Action itself pays within seconds", viaAction > 0, `${viaAction}/3 paid within 6 s`);
  record("commits past 10 per delegation succeed (fee vault)", commits > 10, `${commits} commits`);
  record(`claiming keeps working for ${target} commits`, !failure, failure ? `failed at commit ${commits + 1}: ${failure}` : `Player lamports ${start} → ${lamports}`);
  if (target >= 35) record("commit reserve is refilled before it runs out", toppedUpAt > 0, toppedUpAt ? `topped up before commit ${toppedUpAt + 1}` : "never needed");
  console.log(`      Player lamports on the rollup: ${start} → ${lamports} over ${commits} commits`);

  console.log("\n-- leaving the rollup --");
  await check("withdraw: rollup balance back to the wallet on Solana", async () => {
    const left = BigInt((await fetchPlayer(rollup, user.publicKey)).usdcBalanceE6.toString());
    await send(c.rollup, [await withdrawUsdcIx(rollup, user.publicKey, usdc, left)], [user], "withdraw_usdc all");
    const before = (await getAccount(c.base, userUsdc)).amount;
    await send(c.base, await withdrawFromRollupIxs(user.publicKey, usdc, left, c.validator, user.publicKey), [user], "withdrawSpl");
    await until("base USDC", async () => (await getAccount(c.base, userUsdc)).amount >= before + left, 120);
    return `${Number(left) / 1e6} mUSDC returned`;
  });
  await check("undelegate_player returns the account to the program, and it can be delegated again", async () => {
    await until("nothing in flight", async () => (await fetchPlayer(rollup, user.publicKey)).cards.every((k) => k.state !== CardState.ClaimRequested && k.state !== CardState.RandomnessPending), 90);
    await send(c.rollup, [await undelegatePlayerIx(rollup, user.publicKey)], [user], "undelegate_player");
    await until("owner back on Solana", async () => (await c.base.getAccountInfo(player))?.owner.equals(PROGRAM_ID), 120);
    await send(c.base, [await delegatePlayerIx(base, user.publicKey, c.validator)], [user], "delegate again");
    await until("delegated again", async () => (await c.base.getAccountInfo(player))?.owner.toBase58() === DLP);
  });

  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed`);
  for (const r of bad) console.log(`  FAIL ${r.name}: ${r.note}`);
  process.exit(bad.length ? 2 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
