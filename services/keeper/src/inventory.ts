import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey, type Connection, type Keypair } from "@solana/web3.js";
import { syncInventoryIx, vaultPda, type ScratchersProgram } from "@scratchers/sdk";
import type { Deployments } from "./config.js";
import { log } from "./log.js";
import { sendIx } from "./tx.js";

const REFILL = 100_000n * 1_000_000n; // 100k mock shares
const LOW_WATER = 20_000n * 1_000_000n;

export type VaultHealth = { stock: string; available: bigint; reserved: bigint; free: bigint };
export const vaultHealth = new Map<string, VaultHealth>();

/** Devnet mock refill: mint stock to the vault on Solana, then credit the rollup mirror. Mainnet would swap via the Payments API. */
export function startInventory(o: { program: ScratchersProgram; base: Connection; rollup: Connection; keeper: Keypair; mintAuthority: Keypair; deployments: Deployments; refill: boolean }) {
  const { program, base, rollup, keeper, mintAuthority, deployments, refill } = o;
  async function tick() {
    for (const stock of ["mTSLA", "mNVDA", "mSOL"]) {
      try {
        const mint = new PublicKey(deployments.mints[stock]);
        const v = await program.account.vaultState.fetch(vaultPda(mint), "confirmed").catch(() => null);
        if (!v) continue;
        const available = BigInt(v.availableSharesMirror.toString());
        const reserved = BigInt(v.reservedShares.toString());
        const free = available - reserved;
        vaultHealth.set(stock, { stock, available, reserved, free });
        if (refill && free < LOW_WATER) {
          const vaultToken = getAssociatedTokenAddressSync(mint, vaultPda(mint), true);
          await sendIx(base, mintAuthority, [createAssociatedTokenAccountIdempotentInstruction(mintAuthority.publicKey, vaultToken, vaultPda(mint), mint), createMintToInstruction(mint, vaultToken, mintAuthority.publicKey, REFILL)]);
          await sendIx(rollup, keeper, [await syncInventoryIx(program, keeper.publicKey, mint, REFILL)]);
          log("info", "vault refilled and synced", { stock, shares: (REFILL / 1_000_000n).toString() });
        }
      } catch (e) {
        log("error", "inventory check failed", { stock, err: (e as Error).message });
      }
    }
  }
  const t = setInterval(tick, 30_000);
  tick();
  return () => clearInterval(t);
}
