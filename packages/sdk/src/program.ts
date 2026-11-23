import { AnchorProvider, Program, type Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import idl from "./generated/scratchers.json" with { type: "json" };
import type { Scratchers } from "./generated/scratchers.js";

export type ScratchersProgram = Program<Scratchers>;

/** Read-only program handle; fine for building instructions and decoding accounts. */
export function getProgram(connection: Connection): ScratchersProgram {
  const wallet = { publicKey: Keypair.generate().publicKey } as Wallet; // never signs
  return new Program<Scratchers>(idl as Scratchers, new AnchorProvider(connection, wallet, {}));
}
