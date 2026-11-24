import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey, SystemProgram, type Connection, type Keypair } from "@solana/web3.js";
import type { Deployments } from "./config.js";
import { Cooldown } from "./ratelimit.js";
import { sendIx } from "./tx.js";

// Onboarding rents a 3.7 KB Player (~0.02 SOL), a 0.01 SOL commit-fee reserve, a 0.01 SOL action escrow, token accounts and fees.
const SOL_DRIP = 150_000_000; // 0.15 SOL
const SOL_MIN = 100_000_000; // top up wallets below 0.1 SOL
const USDC_DRIP = 50_000_000n; // 50 mUSDC (6 dp)

/** Test funds: a little SOL for fees plus 50 mock USDC. One claim per wallet per window; devnet only. */
export function makeFaucet(o: { base: Connection; authority: Keypair; deployments: Deployments; cooldownMs: number }) {
  const cooldown = new Cooldown(o.cooldownMs);
  const ipCooldown = new Cooldown(10_000); // coarse per-IP throttle against scripted drains
  return async (walletStr: string, ip: string) => {
    let wallet: PublicKey;
    try { wallet = new PublicKey(walletStr); } catch { return { status: 400, body: { error: "invalid wallet" } }; }
    if (ipCooldown.take(ip)) return { status: 429, body: { error: "slow down" } };
    const wait = cooldown.take(wallet.toBase58());
    if (wait) return { status: 429, body: { error: "already funded recently", retryAfterMs: wait } };
    const mint = new PublicKey(o.deployments.mints.mUSDC);
    const ata = getAssociatedTokenAddressSync(mint, wallet);
    const ixs = [
      createAssociatedTokenAccountIdempotentInstruction(o.authority.publicKey, ata, wallet, mint),
      createMintToInstruction(mint, ata, o.authority.publicKey, USDC_DRIP),
    ];
    if ((await o.base.getBalance(wallet)) < SOL_MIN) ixs.unshift(SystemProgram.transfer({ fromPubkey: o.authority.publicKey, toPubkey: wallet, lamports: SOL_DRIP }));
    const sig = await sendIx(o.base, o.authority, ixs);
    return { status: 200, body: { signature: sig, usdc: Number(USDC_DRIP) / 1e6, usdcAccount: ata.toBase58() } };
  };
}
