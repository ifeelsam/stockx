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

const DLP = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
/** Delegation record of a delegated account (its validator derives the magic fee vault). */
export const delegationRecordPda = (account: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("delegation"), account.toBuffer()], DLP)[0];
/** Validator-scoped fee vault used when committing from a delegated payer. */
export const magicFeeVaultPda = (validator: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("magic-fee-vault"), validator.toBuffer()], DLP)[0];
/** Escrow that pays for post-commit actions (rent) on behalf of `authority`; index 255 is the action default. */
export const escrowPda = (authority: PublicKey, index = 255) =>
  PublicKey.findProgramAddressSync([Buffer.from("balance"), authority.toBuffer(), Buffer.from([index])], DLP)[0];
