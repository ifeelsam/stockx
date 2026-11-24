import BN from "bn.js";
import { createMagicAtaInstruction, createTopUpEscrowInstruction, delegateSpl, withdrawSpl } from "@magicblock-labs/ephemeral-rollups-sdk";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { MAGIC_CONTEXT_ID, MAGIC_PROGRAM_ID, VRF_EPHEMERAL_QUEUE } from "./constants.js";
import { configPda, delegationRecordPda, escrowPda, feedPda, magicFeeVaultPda, payoutPda, playerPda, seriesPda, statsPda, vaultPda } from "./pda.js";
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
  if (a.tiers.length !== 8) throw new Error("a series has exactly 8 tier slots (pad with {multiplier:0, weight:0})");
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

/** Base layer: fund the escrow that pays the Payout receipt rent for post-commit actions (~0.0011 SOL per card). */
export const topUpActionEscrowIx = (payer: PublicKey, player: PublicKey, lamports: bigint) =>
  createTopUpEscrowInstruction(escrowPda(player), player, payer, lamports, 255);

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

/** The program-held USDC token account on the rollup: ATA of the Config PDA. Create it as a Magic ATA. */
export const treasuryUsdc = (usdcMint: PublicKey) => getAssociatedTokenAddressSync(usdcMint, configPda(), true);

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
 * Base layer, owner signs (payer optional): deposit + delegate `amountE6` mock USDC so it appears at the
 * owner's canonical ATA on the rollup. Pin the same `validator` the Player is delegated to.
 * Legacy deposit builder (`idempotent: false`) as in the eSPL reference.
 */
export const depositToRollupIxs = (owner: PublicKey, usdcMint: PublicKey, amountE6: bigint, validator: PublicKey, payer?: PublicKey) =>
  delegateSpl(owner, usdcMint, amountE6, { validator, payer, idempotent: false, initVaultIfMissing: true });

/** Base layer: bring USDC back from the rollup to the owner's base ATA (after `withdraw_usdc` on the rollup). */
export const withdrawFromRollupIxs = (owner: PublicKey, usdcMint: PublicKey, amountE6: bigint, validator: PublicKey, payer?: PublicKey) =>
  withdrawSpl(owner, usdcMint, amountE6, { validator, payer, idempotent: false });

/** Rollup tx (one-time, admin/keeper): create the Config-PDA treasury as a Magic ATA so `deposit_usdc` has a destination. */
export const createTreasuryIx = (payer: PublicKey, usdcMint: PublicKey) => createMagicAtaInstruction(payer, configPda(), usdcMint);
