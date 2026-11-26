import BN from "bn.js";
import { createMagicAtaInstruction, createTopUpEscrowInstruction, DELEGATION_PROGRAM_ID, delegateSpl, deriveEphemeralAta, lamportsDelegatedTransferIx, withdrawSpl } from "@magicblock-labs/ephemeral-rollups-sdk";
import { PublicKey, TransactionInstruction, type Connection } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { MAGIC_CONTEXT_ID, MAGIC_PROGRAM_ID, VRF_EPHEMERAL_QUEUE } from "./constants.js";
import { configPda, delegationRecordPda, escrowPda, feedPda, magicFeeVaultPda, payoutPda, playerPda, seriesPda, statsPda, treasuryAuthPda, vaultPda } from "./pda.js";
import type { ScratchersProgram } from "./program.js";
import type { Tier } from "./tiers.js";
import { totalWeight } from "./tiers.js";

/**
 * Instruction builders. Which connection each one goes to:
 *  base:   initConfig createSeries freezeSeries initVault initFeed signup delegate*
 *  rollup: createSession revokeSession pushPrice buyCard cancelPending undelegate*
 */

// ---- admin (base) -------------------------------------------------------------------------
export const initConfigIx = (p: ScratchersProgram, admin: PublicKey, keeper: PublicKey, usdcMint: PublicKey) =>
  p.methods.initConfig(keeper, usdcMint).accountsPartial({ admin }).instruction();

export type CreateSeriesParams = {
  id: number;
  stockMint: PublicKey;
  source: "selfPushed" | "magicBlockOracle";
  feed: PublicKey;
  feedExpo: number;
  ticketUsdE6: bigint;
  tiers: Tier[];
  demo?: boolean;
  maxStalenessS?: number;
  maxMoveBps?: number;
  maxConfBps?: number;
  vrfTimeoutS?: number;
};

export function createSeriesIx(p: ScratchersProgram, admin: PublicKey, a: CreateSeriesParams): Promise<TransactionInstruction> {
  if (a.tiers.length !== 8) throw new Error("a series has exactly 8 rarity slots (pad with {multiplierBps:0, weight:0})");
  return p.methods
    .createSeries({
      id: a.id,
      priceSource: a.source === "selfPushed" ? { selfPushed: {} } : { magicBlockOracle: {} },
      feed: a.feed,
      feedExpo: a.feedExpo,
      ticketUsdE6: new BN(a.ticketUsdE6.toString()),
      tiers: a.tiers,
      totalWeight: totalWeight(a.tiers),
      demo: a.demo ?? false,
      maxStalenessS: new BN(a.maxStalenessS ?? 30),
      maxMoveBps: a.maxMoveBps ?? 500,
      maxConfBps: a.maxConfBps ?? 100,
      vrfTimeoutS: new BN(a.vrfTimeoutS ?? 120),
    })
    .accountsPartial({ admin, stockMint: a.stockMint, series: seriesPda(a.id) })
    .instruction();
}

export const freezeSeriesIx = (p: ScratchersProgram, admin: PublicKey, seriesId: number) =>
  p.methods.freezeSeries().accountsPartial({ admin, series: seriesPda(seriesId) }).instruction();

export const initVaultIx = (p: ScratchersProgram, admin: PublicKey, stockMint: PublicKey) =>
  p.methods.initVault().accountsPartial({ admin, stockMint }).instruction();

export const initFeedIx = (p: ScratchersProgram, admin: PublicKey, feedId: Uint8Array, pusher: PublicKey, expo: number, maxMoveBps = 500) =>
  p.methods.initFeed(Array.from(feedId), pusher, expo, maxMoveBps).accountsPartial({ admin }).instruction();

export const initStatsIx = (p: ScratchersProgram, admin: PublicKey, seriesId: number) =>
  p.methods.initStats(seriesId).accountsPartial({ admin, series: seriesPda(seriesId), stats: statsPda(seriesId) }).instruction();

export const delegateStatsIx = (p: ScratchersProgram, admin: PublicKey, seriesId: number, validator: PublicKey) =>
  p.methods.delegateStats(seriesId, validator).accountsPartial({ admin, stats: statsPda(seriesId) }).instruction();

export const undelegateStatsIx = (p: ScratchersProgram, admin: PublicKey, seriesId: number) =>
  p.methods.undelegateStats().accountsPartial({ admin, stats: statsPda(seriesId) }).instruction();

export const delegateVaultIx = (p: ScratchersProgram, admin: PublicKey, stockMint: PublicKey, validator: PublicKey) =>
  p.methods.delegateVault(validator).accountsPartial({ admin, stockMint, vaultState: vaultPda(stockMint) }).instruction();

export const delegateFeedIx = (p: ScratchersProgram, admin: PublicKey, feedId: Uint8Array, validator: PublicKey) =>
  p.methods.delegateFeed(Array.from(feedId), validator).accountsPartial({ admin, feed: feedPda(feedId) }).instruction();

// ---- player (base) ------------------------------------------------------------------------
export const signupIx = (p: ScratchersProgram, authority: PublicKey) =>
  p.methods.signup().accountsPartial({ authority }).instruction();

export const delegatePlayerIx = (p: ScratchersProgram, authority: PublicKey, validator: PublicKey) =>
  p.methods.delegatePlayer(validator).accountsPartial({ authority, player: playerPda(authority) }).instruction();

// ---- rollup -------------------------------------------------------------------------------
export const createSessionIx = (p: ScratchersProgram, authority: PublicKey, sessionKey: PublicKey, expiryUnix: number, capE6: bigint) =>
  p.methods
    .createSession(sessionKey, new BN(expiryUnix), new BN(capE6.toString()))
    .accountsPartial({ authority, player: playerPda(authority) })
    .instruction();

export const revokeSessionIx = (p: ScratchersProgram, authority: PublicKey) =>
  p.methods.revokeSession().accountsPartial({ authority, player: playerPda(authority) }).instruction();

export const pushPriceIx = (p: ScratchersProgram, pusher: PublicKey, feedId: Uint8Array, price: bigint, conf: bigint, publishTs: number) =>
  p.methods
    .pushPrice(new BN(price.toString()), new BN(conf.toString()), new BN(publishTs))
    .accountsPartial({ pusher, feed: feedPda(feedId) })
    .instruction();

export type BuyCardParams = {
  /** The player's authority, or its session key. */
  signer: PublicKey;
  authority: PublicKey;
  seriesId: number;
  stockMint: PublicKey;
  feed: PublicKey;
  n: number;
  /** 1e8 fixed point; the buy fails if the on-chain price is higher. */
  maxPrice: bigint;
  /** 32 bytes of client entropy mixed into the VRF request. */
  callerSeed: Uint8Array;
};

export function buyCardIx(p: ScratchersProgram, a: BuyCardParams): Promise<TransactionInstruction> {
  if (a.n < 1 || a.n > 10) throw new Error("n must be 1..=10");
  if (a.callerSeed.length !== 32) throw new Error("callerSeed must be 32 bytes");
  return p.methods
    .buyCard(a.n, new BN(a.maxPrice.toString()), Array.from(a.callerSeed))
    .accountsPartial({
      signer: a.signer,
      authority: a.authority,
      player: playerPda(a.authority),
      config: configPda(),
      series: seriesPda(a.seriesId),
      vaultState: vaultPda(a.stockMint),
      stats: statsPda(a.seriesId),
      priceFeed: a.feed,
      oracleQueue: VRF_EPHEMERAL_QUEUE,
    })
    .instruction();
}

export const cancelPendingIx = (p: ScratchersProgram, signer: PublicKey, authority: PublicKey, seriesId: number, stockMint: PublicKey, cardId: bigint) =>
  p.methods
    .cancelPending(new BN(cardId.toString()))
    .accountsPartial({ signer, authority, player: playerPda(authority), series: seriesPda(seriesId), vaultState: vaultPda(stockMint) })
    .instruction();

export const undelegatePlayerIx = (p: ScratchersProgram, authority: PublicKey) =>
  p.methods
    .undelegatePlayer()
    .accountsPartial({ authority, player: playerPda(authority), magicProgram: MAGIC_PROGRAM_ID, magicContext: MAGIC_CONTEXT_ID })
    .instruction();

/** Rollup. Credit the inventory mirror after transferring stock into the vault token account on Solana. */
export const syncInventoryIx = (p: ScratchersProgram, authority: PublicKey, stockMint: PublicKey, addedShares: bigint) =>
  p.methods.syncInventory(new BN(addedShares.toString())).accountsPartial({ authority, vaultState: vaultPda(stockMint) }).instruction();

// ---- settlement ---------------------------------------------------------------------------

/** Base layer: the player's stock ATA must exist before a win can be paid (created at signup). */
export const createStockAtaIx = (payer: PublicKey, owner: PublicKey, stockMint: PublicKey) =>
  createAssociatedTokenAccountIdempotentInstruction(payer, getAssociatedTokenAddressSync(stockMint, owner), owner, stockMint);

/**
 * Every card (Dust included) rents a ~0.0008 SOL Payout receipt from the player's action escrow. If a claim can pay its
 * receipts but would leave the escrow below rent, the whole commit transaction fails, and no later commit of that
 * Player lands (seen on devnet; a top-up afterwards does not recover it). So refill below `LOW`, which covers a full
 * Player (32 receipts) with room to spare.
 */
export const ACTION_ESCROW_LAMPORTS = 50_000_000n;
export const ACTION_ESCROW_LOW_LAMPORTS = 30_000_000n;
/** Lamports to add before claiming; 0 while the escrow is safe. */
export const actionEscrowShortfall = (balance: number): bigint =>
  BigInt(balance) < ACTION_ESCROW_LOW_LAMPORTS ? ACTION_ESCROW_LAMPORTS - BigInt(balance) : 0n;

/** Base layer: fund the escrow that pays the Payout receipt rent for post-commit actions. */
export const topUpActionEscrowIx = (payer: PublicKey, player: PublicKey, lamports: bigint) =>
  createTopUpEscrowInstruction(escrowPda(player), player, payer, lamports, 255);

/** Each commit from the 26th per delegation costs this much, from the Player's lamports above rent. */
export const COMMIT_FEE_LAMPORTS = 1_000_000;
/** Top the reserve up when fewer than `LOW` lamports remain; `signup` funds the first 0.01 SOL. */
export const PLAYER_RESERVE_LOW_LAMPORTS = 3 * COMMIT_FEE_LAMPORTS;
export const PLAYER_RESERVE_TOP_UP_LAMPORTS = 10_000_000n;

/** Base layer: add lamports to the delegated Player on the rollup. */
export const topUpPlayerReserveIx = (payer: PublicKey, authority: PublicKey, lamports: bigint = PLAYER_RESERVE_TOP_UP_LAMPORTS) =>
  lamportsDelegatedTransferIx(payer, playerPda(authority), lamports, crypto.getRandomValues(new Uint8Array(32)));

/** Rollup: claims up to 8 revealed cards of one series; commit + Magic Action pays shares on Solana. */
export const claimAllIx = (p: ScratchersProgram, signer: PublicKey, authority: PublicKey, seriesId: number, stockMint: PublicKey, validator: PublicKey) =>
  p.methods
    .claimAll(seriesId)
    .accountsPartial({
      signer,
      authority,
      player: playerPda(authority),
      series: seriesPda(seriesId),
      vaultState: vaultPda(stockMint),
      delegationRecordPlayer: delegationRecordPda(playerPda(authority)),
      magicFeeVault: magicFeeVaultPda(validator),
      magicContext: MAGIC_CONTEXT_ID,
      magicProgram: MAGIC_PROGRAM_ID,
    })
    .instruction();

/** Rollup: after the base-layer Payout exists, free the slot. Anyone may call with that proof. */
export const markSettledIx = (p: ScratchersProgram, authority: PublicKey, cardId: bigint) =>
  p.methods.markSettled(new BN(cardId.toString())).accountsPartial({ authority, player: playerPda(authority) }).instruction();

/** Base layer, keeper only: repairs a dropped Magic Action. Fails with AlreadyPaid if the card was paid. */
export const payOutIx = (p: ScratchersProgram, keeper: PublicKey, authority: PublicKey, seriesId: number, stockMint: PublicKey, cardId: bigint) =>
  p.methods
    .payOut(new BN(cardId.toString()))
    .accountsPartial({
      keeper,
      player: playerPda(authority),
      series: seriesPda(seriesId),
      vaultState: vaultPda(stockMint),
      vaultToken: getAssociatedTokenAddressSync(stockMint, vaultPda(stockMint), true),
      dest: getAssociatedTokenAddressSync(stockMint, authority),
      stockMint,
      payout: payoutPda(playerPda(authority), cardId),
    })
    .instruction();

// ---- USDC in and out (rollup) --------------------------------------------------------------

/** The program-held USDC token account on the rollup: ATA of the `treasury` PDA, created as a Magic ATA (rollup only). */
export const treasuryUsdc = (usdcMint: PublicKey) => getAssociatedTokenAddressSync(usdcMint, treasuryAuthPda(), true);

const fundsAccounts = (authority: PublicKey, usdcMint: PublicKey) => ({
  authority,
  player: playerPda(authority),
  usdcMint,
  userUsdc: getAssociatedTokenAddressSync(usdcMint, authority),
  treasuryUsdc: treasuryUsdc(usdcMint),
});

/** After `delegateSpl` put USDC on the rollup: move it into the treasury and credit the in-app balance. */
export const depositUsdcIx = (p: ScratchersProgram, authority: PublicKey, usdcMint: PublicKey, amountE6: bigint) =>
  p.methods.depositUsdc(new BN(amountE6.toString())).accountsPartial(fundsAccounts(authority, usdcMint)).instruction();

/** Owner only (a session key cannot withdraw). Returns USDC to the owner's rollup token account. */
export const withdrawUsdcIx = (p: ScratchersProgram, authority: PublicKey, usdcMint: PublicKey, amountE6: bigint) =>
  p.methods.withdrawUsdc(new BN(amountE6.toString())).accountsPartial(fundsAccounts(authority, usdcMint)).instruction();

// ---- USDC onboarding (eSPL) ------------------------------------------------------------------

/**
 * Base layer, owner signs (payer optional): move `amountE6` mock USDC to the owner's canonical ATA on the rollup.
 * Pin the same `validator` the Player is delegated to. Two builders, because neither covers both cases (live devnet):
 * the first deposit must use the legacy one (a shuttle merge can run before the rollup ATA exists and strand the
 * amount), and top-ups must use the shuttle (the legacy one rejects an already-delegated balance).
 */
export async function depositToRollupIxs(base: Connection, owner: PublicKey, usdcMint: PublicKey, amountE6: bigint, validator: PublicKey, payer?: PublicKey) {
  const eata = await base.getAccountInfo(deriveEphemeralAta(owner, usdcMint)[0], "confirmed");
  const delegated = eata?.owner.equals(DELEGATION_PROGRAM_ID) ?? false;
  return delegateSpl(owner, usdcMint, amountE6, { validator, payer, idempotent: delegated, initVaultIfMissing: true });
}

/**
 * A shuttle deposit creates the rollup token account first and merges the amount in a moment later:
 * wait for the amount, not the account. Returns the rollup balance to pass to `depositUsdcIx`.
 */
export async function waitForRollupUsdc(rollup: Connection, owner: PublicKey, usdcMint: PublicKey, atLeastE6: bigint, timeoutMs = 60_000): Promise<bigint> {
  const ata = getAssociatedTokenAddressSync(usdcMint, owner);
  for (const end = Date.now() + timeoutMs; ; await new Promise((r) => setTimeout(r, 1000))) {
    const info = await rollup.getAccountInfo(ata, "confirmed");
    const have = info && info.data.length >= 72 ? new DataView(info.data.buffer, info.data.byteOffset).getBigUint64(64, true) : 0n; // SPL amount
    if (have >= atLeastE6) return have;
    if (Date.now() > end) throw new Error("the deposit has not reached the rollup yet: try again in a moment");
  }
}

/**
 * Base layer: bring USDC back from the rollup to the owner's base ATA (after `withdraw_usdc` on the rollup).
 * Default shuttle withdrawal: the legacy builder only works once the eATA has been undelegated.
 */
export const withdrawFromRollupIxs = (owner: PublicKey, usdcMint: PublicKey, amountE6: bigint, validator: PublicKey, payer?: PublicKey) =>
  withdrawSpl(owner, usdcMint, amountE6, { validator, payer });

/** Rollup tx (one-time, admin/keeper): create the treasury as a Magic ATA so `deposit_usdc` has a destination. */
export const createTreasuryIx = (payer: PublicKey, usdcMint: PublicKey) => createMagicAtaInstruction(payer, treasuryAuthPda(), usdcMint);
