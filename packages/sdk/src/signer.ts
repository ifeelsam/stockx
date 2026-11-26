import { Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

/** The only signing surface the SDK knows. Privy / MWA adapters live in the apps. */
export interface Signer {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions?<T extends Transaction>(txs: T[]): Promise<T[]>;
}

/** Wrap a platform wallet's sign function (Privy `signTransaction`, MWA `signTransactions`, ...). */
export function signerFrom(publicKey: PublicKey, sign: Signer["signTransaction"]): Signer {
  return { publicKey, signTransaction: sign };
}

/** Local ed25519 key: signs buy/claim/cancel on the rollup with no popups. */
export class SessionKeySigner implements Signer {
  constructor(readonly keypair: Keypair = Keypair.generate()) {}
  get publicKey() {
    return this.keypair.publicKey;
  }
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof VersionedTransaction) tx.sign([this.keypair]);
    else tx.partialSign(this.keypair);
    return tx;
  }
  async signAllTransactions<T extends Transaction>(txs: T[]): Promise<T[]> {
    return Promise.all(txs.map((t) => this.signTransaction(t)));
  }
}

/** Sign (never sign-and-send) and submit through the given connection. */
export async function signAndSend(
  connection: import("@solana/web3.js").Connection,
  signer: Signer,
  tx: Transaction,
  opts: { skipPreflight?: boolean } = {},
): Promise<string> {
  tx.feePayer = signer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const signed = await signer.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: opts.skipPreflight ?? false });
  // confirmation resolves for failed transactions too (the rollup records them even without preflight)
  const { value } = await connection.confirmTransaction(sig, "confirmed");
  if (value.err) throw new Error(`transaction ${sig} failed: ${JSON.stringify(value.err)}`);
  return sig;
}
