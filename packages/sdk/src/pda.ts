import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./constants.js";

const u16le = (n: number) => Buffer.from(new Uint16Array([n]).buffer);
const find = (seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];

export const configPda = () => find([Buffer.from("config")]);
export const seriesPda = (id: number) => find([Buffer.from("series"), u16le(id)]);
export const playerPda = (authority: PublicKey) => find([Buffer.from("player"), authority.toBuffer()]);
export const vaultPda = (stockMint: PublicKey) => find([Buffer.from("vault"), stockMint.toBuffer()]);
export const feedPda = (feedId: Uint8Array) => find([Buffer.from("feed"), feedId]);
export const programIdentityPda = () => find([Buffer.from("identity")]);
export const payoutPda = (player: PublicKey, cardId: bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(cardId);
  return find([Buffer.from("payout"), player.toBuffer(), b]);
};
