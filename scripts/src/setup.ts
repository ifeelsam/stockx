/**
 * Idempotent devnet setup: mock mints, config, price feeds, series (+freeze), vaults, vault funding,
 * delegation of vaults/feeds, rollup inventory sync. Safe to re-run.
 *
 *   RPC_URL=...            base-layer RPC (default: MagicBlock devnet)
 *   DEPLOYER_KEYPAIR=...   default ~/.config/stockx/deployer.json (admin + mint authority)
 *   SKIP_DELEGATE=1        stop after base-layer setup (local validator)
 */
import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, createTransferInstruction, getAssociatedTokenAddressSync, createInitializeMint2Instruction, getMinimumBalanceForRentExemptMint, MINT_SIZE, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  configPda, connect, createSeriesIx, DEFAULT_TIERS, delegateFeedIx, delegateVaultIx, feedPda, freezeSeriesIx, getProgram, initConfigIx,
  createTreasuryIx, treasuryUsdc, initFeedIx, initSellQuoteIx, initStatsIx, delegateStatsIx, statsPda, initVaultIx, sellQuotePda, seriesPda, syncInventoryIx, vaultPda, type Tier, DEVNET_VALIDATORS,
} from "@scratchers/sdk";
import { exists, hex, KEY_DIR, loadOrCreateKey, send, sleep } from "./lib.js";

const DELEGATION_PROGRAM = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const DEMO_TIERS: Tier[] = [ // "DEMO ODDS": jackpot ≈ 1 in 20. Never presented as the real table.
  { multiplier: 0, weight: 40_000 }, { multiplier: 1, weight: 25_000 }, { multiplier: 2, weight: 15_000 }, { multiplier: 5, weight: 9_000 },
  { multiplier: 10, weight: 4_000 }, { multiplier: 50, weight: 1_500 }, { multiplier: 100, weight: 500 }, { multiplier: 1000, weight: 5_000 },
];
// Pyth Hermes feed ids (looked up via /v2/price_feeds, 2026-11-24).
const STOCKS = {
  mTSLA: { feedId: hex("16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1") },
  mNVDA: { feedId: hex("b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593") },
  mSOL: { feedId: hex("ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d") },
} as const;
type Sym = keyof typeof STOCKS;
// id, stock, tiers, demo. Series 3 is crypto-priced so the app is never fully paused when US markets are shut.
const SERIES: { id: number; sym: Sym; tiers: Tier[]; demo: boolean; label: string }[] = [
  { id: 1, sym: "mTSLA", tiers: DEFAULT_TIERS, demo: false, label: "TSLA" },
  { id: 2, sym: "mNVDA", tiers: DEFAULT_TIERS, demo: false, label: "NVDA" },
  { id: 3, sym: "mSOL", tiers: DEFAULT_TIERS, demo: false, label: "SOL (always on)" },
  { id: 4, sym: "mTSLA", tiers: DEMO_TIERS, demo: true, label: "TSLA DEMO ODDS" },
];
const VAULT_SHARES = 100_000n * 1_000_000n; // 100k mock shares per stock
const SELL_POOL_USDC = 1_000_000n * 1_000_000n; // 1M mUSDC the vault pays sellers from

async function ensureMint(conn: Connection, payer: Keypair, name: string): Promise<PublicKey> {
  const mint = loadOrCreateKey(join(KEY_DIR, "mints", `${name}.json`));
  if (!(await exists(conn, mint.publicKey))) {
    await send(conn, [
      SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey, space: MINT_SIZE, lamports: await getMinimumBalanceForRentExemptMint(conn), programId: TOKEN_PROGRAM_ID }),
      createInitializeMint2Instruction(mint.publicKey, 6, payer.publicKey, null),
    ], [payer, mint], `create mint ${name}`);
  }
  return mint.publicKey;
}

async function main() {
  const c = connect({ baseUrl: process.env.RPC_URL, region: (process.env.REGION as keyof typeof DEVNET_VALIDATORS) ?? "asia" });
  const base = c.base;
  const admin = loadOrCreateKey(process.env.DEPLOYER_KEYPAIR ?? join(KEY_DIR, "deployer.json"));
  const keeper = loadOrCreateKey(join(KEY_DIR, "keeper.json")); // keeper + price pusher
  const program = getProgram(base);
  console.log(`admin ${admin.publicKey.toBase58()}  keeper ${keeper.publicKey.toBase58()}  rpc ${base.rpcEndpoint}`);

  const mints: Record<string, PublicKey> = {};
  for (const n of ["mUSDC", "mTSLA", "mNVDA", "mSOL"]) mints[n] = await ensureMint(base, admin, n);

  if (!(await exists(base, configPda()))) await send(base, [await initConfigIx(program, admin.publicKey, keeper.publicKey, mints.mUSDC)], [admin], "init_config");

  for (const [sym, s] of Object.entries(STOCKS)) {
    if (!(await exists(base, feedPda(s.feedId)))) await send(base, [await initFeedIx(program, admin.publicKey, s.feedId, keeper.publicKey, -8)], [admin], `init_feed ${sym}`);
  }

  for (const s of SERIES) {
    if (await exists(base, seriesPda(s.id))) continue;
    await send(base, [
      await createSeriesIx(program, admin.publicKey, {
        id: s.id, stockMint: mints[s.sym], source: "selfPushed", feed: feedPda(STOCKS[s.sym].feedId), feedExpo: -8,
        ticketUsdE6: 1_000_000n, tiers: s.tiers, demo: s.demo, maxStalenessS: s.sym === "mSOL" ? 30 : 60, vrfTimeoutS: 120,
      }),
      await freezeSeriesIx(program, admin.publicKey, s.id),
    ], [admin], `create+freeze series ${s.id} ${s.label}`);
  }

  for (const s of SERIES) {
    if (!(await exists(base, statsPda(s.id)))) await send(base, [await initStatsIx(program, admin.publicKey, s.id)], [admin], `init_stats ${s.id}`);
  }

  for (const sym of Object.keys(STOCKS)) {
    const mint = mints[sym];
    const vault = vaultPda(mint);
    if (!(await exists(base, vault))) await send(base, [await initVaultIx(program, admin.publicKey, mint)], [admin], `init_vault ${sym}`);
    const vaultToken = getAssociatedTokenAddressSync(mint, vault, true);
    const funded = (await base.getTokenAccountBalance(vaultToken).catch(() => null))?.value.amount ?? "0";
    if (BigInt(funded) < VAULT_SHARES) {
      const adminAta = getAssociatedTokenAddressSync(mint, admin.publicKey);
      const top = VAULT_SHARES - BigInt(funded);
      await send(base, [
        createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, adminAta, admin.publicKey, mint),
        createMintToInstruction(mint, adminAta, admin.publicKey, top),
        createTransferInstruction(adminAta, vaultToken, admin.publicKey, top),
      ], [admin], `fund_vault ${sym} +${top / 1_000_000n} shares`);
    }
  }

  // Sell quotes (base layer) + the USDC pool the vault pays sellers from. ts=1 so the keeper's first
  // quote is never band-limited and sells stay paused until a real price is posted.
  for (const sym of Object.keys(STOCKS)) {
    if (!(await exists(base, sellQuotePda(mints[sym])))) await send(base, [await initSellQuoteIx(program, admin.publicKey, mints[sym], mints.mUSDC, 100_000_000n, 1)], [admin], `init_sell_quote ${sym}`);
  }
  const pool = getAssociatedTokenAddressSync(mints.mUSDC, configPda(), true);
  const poolBal = BigInt((await base.getTokenAccountBalance(pool).catch(() => null))?.value.amount ?? "0");
  if (poolBal < SELL_POOL_USDC) await send(base, [createMintToInstruction(mints.mUSDC, pool, admin.publicKey, SELL_POOL_USDC - poolBal)], [admin], `fund sell pool +${(SELL_POOL_USDC - poolBal) / 1_000_000n} mUSDC`);

  const out = {
    network: "devnet", rpc: base.rpcEndpoint, program: program.programId.toBase58(), admin: admin.publicKey.toBase58(), keeper: keeper.publicKey.toBase58(),
    validator: c.validator.toBase58(),
    mints: Object.fromEntries(Object.entries(mints).map(([k, v]) => [k, v.toBase58()])),
    feeds: Object.fromEntries(Object.entries(STOCKS).map(([k, v]) => [k, { id: Buffer.from(v.feedId).toString("hex"), pda: feedPda(v.feedId).toBase58() }])),
    series: SERIES.map((s) => ({ id: s.id, stock: s.sym, demo: s.demo, pda: seriesPda(s.id).toBase58(), vault: vaultPda(mints[s.sym]).toBase58() })),
  };
  const json = JSON.stringify(out, null, 2) + "\n";
  writeFileSync(process.env.DEPLOYMENTS_OUT ?? join(import.meta.dirname, "../../deployments/devnet.json"), json);
  // public, non-secret: the web app (chain mode) and mobile read the same addresses
  if (!process.env.DEPLOYMENTS_OUT) writeFileSync(join(import.meta.dirname, "../../apps/web/public/deployments.json"), json);

  if (process.env.SKIP_DELEGATE) return console.log("SKIP_DELEGATE set: base-layer setup done.");

  // Delegate vaults + feeds to the rollup validator, then credit inventory there.
  for (const sym of Object.keys(STOCKS)) {
    const [vault, feed] = [vaultPda(mints[sym]), feedPda(STOCKS[sym as Sym].feedId)];
    if ((await base.getAccountInfo(vault))?.owner.equals(DELEGATION_PROGRAM) !== true)
      await send(base, [await delegateVaultIx(program, admin.publicKey, mints[sym], c.validator)], [admin], `delegate_vault ${sym}`);
    if ((await base.getAccountInfo(feed))?.owner.equals(DELEGATION_PROGRAM) !== true)
      await send(base, [await delegateFeedIx(program, admin.publicKey, STOCKS[sym as Sym].feedId, c.validator)], [admin], `delegate_feed ${sym}`);
  }
  for (const s of SERIES) {
    if ((await base.getAccountInfo(statsPda(s.id)))?.owner.equals(DELEGATION_PROGRAM) !== true)
      await send(base, [await delegateStatsIx(program, admin.publicKey, s.id, c.validator)], [admin], `delegate_stats ${s.id}`);
  }
  for (const sym of Object.keys(STOCKS)) {
    const vault = vaultPda(mints[sym]);
    for (let i = 0; i < 20 && !(await c.rollup.getAccountInfo(vault)); i++) await sleep(1000); // wait for the clone
    // the vault is delegated: only the rollup copy is current (a base read fails or is stale)
    const v = await getProgram(c.rollup).account.vaultState.fetch(vault, "confirmed").catch(() => null);
    if (v && v.availableSharesMirror.gtn(0)) continue; // already synced
    await send(c.rollup, [await syncInventoryIx(program, admin.publicKey, mints[sym], VAULT_SHARES)], [admin], `sync_inventory ${sym}`);
  }
  // USDC treasury: a Magic ATA owned by the Config PDA, created on the rollup so deposit_usdc has a destination.
  if (!(await exists(c.rollup, treasuryUsdc(mints.mUSDC)))) await send(c.rollup, [createTreasuryIx(admin.publicKey, mints.mUSDC)], [admin], "create treasury (Magic ATA)");
  console.log("devnet setup complete → deployments/devnet.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
