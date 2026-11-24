import BN from "bn.js";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { ScratchersProgram } from "./program.js";
import { sellQuotePda } from "./pda.js";
import { signAndSend, type Signer } from "./signer.js";
import type { Network } from "./constants.js";

/** Mirrors the program: spread taken on sells, quote TTL. Keep in sync with state.rs. */
export const SELL_SPREAD_BPS = 50n;
export const SELL_QUOTE_TTL_S = 90;

/** USDC (1e-6) paid for `shares` (1e-6 units) at `priceE8`, less the spread. Floors, like `usdc_for_sale`. */
export function usdcForSale(shares: bigint, priceE8: bigint): bigint {
  return (((shares * priceE8) / 100_000_000n) * (10_000n - SELL_SPREAD_BPS)) / 10_000n;
}

// ---- builders (base layer) ---------------------------------------------------------------
export const initSellQuoteIx = (p: ScratchersProgram, admin: PublicKey, stockMint: PublicKey, usdcMint: PublicKey, priceE8: bigint, ts: number) =>
  p.methods.initSellQuote(new BN(priceE8.toString()), new BN(ts)).accountsPartial({ admin, stockMint, usdcMint }).instruction();

export const setSellQuoteIx = (p: ScratchersProgram, authority: PublicKey, stockMint: PublicKey, priceE8: bigint, ts: number) =>
  p.methods.setSellQuote(new BN(priceE8.toString()), new BN(ts)).accountsPartial({ authority, quote: sellQuotePda(stockMint) }).instruction();

export const ackSoldIx = (p: ScratchersProgram, authority: PublicKey, stockMint: PublicKey, totalSynced: bigint) =>
  p.methods.ackSold(new BN(totalSynced.toString())).accountsPartial({ authority, quote: sellQuotePda(stockMint) }).instruction();

export const sellToVaultIx = (p: ScratchersProgram, user: PublicKey, stockMint: PublicKey, usdcMint: PublicKey, shares: bigint, minUsdcE6: bigint) =>
  p.methods
    .sellToVault(new BN(shares.toString()), new BN(minUsdcE6.toString()))
    .accountsPartial({ user, stockMint, usdcMint, quote: sellQuotePda(stockMint), userStock: getAssociatedTokenAddressSync(stockMint, user) })
    .instruction();

export type SellQuoteView = { priceE8: bigint; ts: number; ageS: number; stale: boolean; totalSoldShares: bigint; syncedSoldShares: bigint };

export async function fetchSellQuote(p: ScratchersProgram, stockMint: PublicKey, nowS = Math.floor(Date.now() / 1000)): Promise<SellQuoteView> {
  const q = await p.account.sellQuote.fetch(sellQuotePda(stockMint), "confirmed");
  const ts = q.ts.toNumber();
  return {
    priceE8: BigInt(q.priceE8.toString()),
    ts,
    ageS: nowS - ts,
    stale: nowS - ts > SELL_QUOTE_TTL_S,
    totalSoldShares: BigInt(q.totalSoldShares.toString()),
    syncedSoldShares: BigInt(q.syncedSoldShares.toString()),
  };
}

// ---- sell(): one interface, two backends --------------------------------------------------
export type SellParams = {
  program: ScratchersProgram;
  /** Solana base-layer connection (stock lives here) */
  base: Connection;
  signer: Signer;
  network: Network | "mainnet";
  stockMint: PublicKey;
  usdcMint: PublicKey;
  shares: bigint;
  /** reject if the payout would be below this (1e-6 USDC). Default: the current quote minus 1%. */
  minUsdcE6?: bigint;
  backend?: "devnetVault" | "paymentsApi";
  paymentsApiUrl?: string;
  slippageBps?: number;
};

/**
 * Devnet: `sell_to_vault` against the keeper-posted quote (mock mints can't route through a DEX).
 * Mainnet: MagicBlock Payments API swap (`/v1/swap/quote` → `/v1/swap/swap`), implemented below but
 * refused on devnet. Returns the signature.
 */
export async function sell(a: SellParams): Promise<string> {
  const backend = a.backend ?? (a.network === "mainnet" ? "paymentsApi" : "devnetVault");
  if (backend === "paymentsApi") {
    if (a.network !== "mainnet") throw new Error("Payments API swaps are disabled on devnet: it cannot route mock mints");
    const tx = await paymentsSwapTx({
      baseUrl: a.paymentsApiUrl ?? "https://payments.magicblock.app",
      userPublicKey: a.signer.publicKey,
      inputMint: a.stockMint,
      outputMint: a.usdcMint,
      amount: a.shares,
      slippageBps: a.slippageBps ?? 100,
    });
    const signed = await a.signer.signTransaction(tx);
    const sig = await a.base.sendRawTransaction(signed.serialize());
    await a.base.confirmTransaction(sig, "confirmed");
    return sig;
  }
  const quote = await fetchSellQuote(a.program, a.stockMint);
  if (quote.stale) throw new Error("Sell price paused: quote is stale (market closed or keeper offline)");
  const min = a.minUsdcE6 ?? (usdcForSale(a.shares, quote.priceE8) * 99n) / 100n;
  const tx = new Transaction().add(await sellToVaultIx(a.program, a.signer.publicKey, a.stockMint, a.usdcMint, a.shares, min));
  return signAndSend(a.base, a.signer, tx);
}

/** MagicBlock Payments API swap: quote then unsigned tx. Public visibility; the caller signs and submits. */
export async function paymentsSwapTx(o: {
  baseUrl: string;
  userPublicKey: PublicKey;
  inputMint: PublicKey;
  outputMint: PublicKey;
  amount: bigint;
  slippageBps: number;
  fetchImpl?: typeof fetch;
}): Promise<VersionedTransaction> {
  const f = o.fetchImpl ?? fetch;
  const qs = new URLSearchParams({
    inputMint: o.inputMint.toBase58(),
    outputMint: o.outputMint.toBase58(),
    amount: o.amount.toString(),
    slippageBps: String(o.slippageBps),
    swapMode: "ExactIn",
  });
  const q = await f(`${o.baseUrl}/v1/swap/quote?${qs}`);
  if (!q.ok) throw new Error(`swap quote failed: ${q.status} ${await q.text()}`);
  const quoteResponse = await q.json();
  const s = await f(`${o.baseUrl}/v1/swap/swap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userPublicKey: o.userPublicKey.toBase58(), quoteResponse, visibility: "public" }),
  });
  if (!s.ok) throw new Error(`swap build failed: ${s.status} ${await s.text()}`);
  const { swapTransaction } = (await s.json()) as { swapTransaction: string };
  return VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));
}
