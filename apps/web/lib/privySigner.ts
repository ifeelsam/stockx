"use client";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import { useMemo } from "react";
import type { Signer } from "@scratchers/sdk";

/** Privy embedded/external Solana wallet as an SDK Signer. Sign only: sending goes through our own RPC routing. */
export function usePrivySigner(): Signer | null {
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const wallet = wallets[0];
  return useMemo(() => {
    if (!wallet) return null;
    return {
      publicKey: new PublicKey(wallet.address),
      async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
        const isV0 = tx instanceof VersionedTransaction;
        const bytes = isV0 ? tx.serialize() : tx.serialize({ requireAllSignatures: false, verifySignatures: false });
        const { signedTransaction } = await signTransaction({ transaction: bytes, wallet, chain: "solana:devnet" });
        return (isV0 ? VersionedTransaction.deserialize(signedTransaction) : Transaction.from(signedTransaction)) as T;
      },
    };
  }, [wallet, signTransaction]);
}
