import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction, TransactionInstruction } from "@solana/web3.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const KEY_DIR = join(homedir(), ".config", "stockx");

/** Load a keypair file, or create it (0600) if missing. Keys live outside the repo. */
export function loadOrCreateKey(path: string): Keypair {
  if (existsSync(path)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
  mkdirSync(dirname(path), { recursive: true });
  const k = Keypair.generate();
  writeFileSync(path, JSON.stringify(Array.from(k.secretKey)), { mode: 0o600 });
  return k;
}

export async function send(conn: Connection, ixs: TransactionInstruction[], signers: Keypair[], label: string): Promise<string> {
  const tx = new Transaction().add(...ixs);
  try {
    const sig = await sendAndConfirmTransaction(conn, tx, signers, { commitment: "confirmed" });
    console.log(`  ✓ ${label} ${sig.slice(0, 12)}…`);
    return sig;
  } catch (e) {
    console.error(`  ✗ ${label}: ${(e as Error).message}`);
    throw e;
  }
}

export const exists = async (conn: Connection, a: PublicKey) => (await conn.getAccountInfo(a)) !== null;
export const hex = (s: string) => Uint8Array.from(Buffer.from(s, "hex"));
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
