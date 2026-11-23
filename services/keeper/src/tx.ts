import { Connection, Keypair, Transaction, TransactionInstruction } from "@solana/web3.js";

/** Sign locally and submit. `confirm: false` is for the 400 ms price loop (fire and log). */
export async function sendIx(conn: Connection, signer: Keypair, ixs: TransactionInstruction[], opts: { confirm?: boolean } = {}): Promise<string> {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = signer.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(signer);
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  if (opts.confirm !== false) await conn.confirmTransaction(sig, "confirmed");
  return sig;
}
