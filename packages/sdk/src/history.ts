import type { Connection, PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./constants.js";
import { playerPda } from "./pda.js";
import type { ScratchersProgram } from "./program.js";

export type PastCard = { id: number; series: number; lockedPrice: bigint; shares: bigint; seed: Uint8Array };

/** Events our program logged in one transaction; look-alike lines emitted by other programs are ignored. */
export function programEvents(program: ScratchersProgram, logs: string[]) {
  const ours = PROGRAM_ID.toBase58();
  const stack: string[] = [];
  const events: { name: string; data: any }[] = [];
  for (const line of logs) {
    const frame = /^Program (\w+) (invoke|success|failed)/.exec(line);
    if (frame) frame[2] === "invoke" ? stack.push(frame[1]) : stack.pop();
    else if (line.startsWith("Program data: ") && stack.at(-1) === ours) {
      const e = program.coder.events.decode(line.slice("Program data: ".length));
      if (e) events.push(e);
    }
  }
  return events;
}

/**
 * Every card a player has had revealed, rebuilt from rollup transaction logs. The Player account only keeps 32
 * slots and the next pack reuses settled ones, so the slots alone are not a collection.
 * ponytail: reads up to 1,000 transactions (about 300 cards), as far back as the rollup keeps them; index
 * CardRevealed events server-side once that is not enough.
 */
export async function fetchCardHistory(program: ScratchersProgram, rollup: Connection, authority: PublicKey): Promise<PastCard[]> {
  const player = playerPda(authority);
  const sigs = (await rollup.getSignaturesForAddress(player, { limit: 1000 }, "confirmed")).filter((s) => !s.err);
  const bought = new Map<number, { series: number; lockedPrice: bigint }>();
  const revealed = new Map<number, { shares: bigint; seed: Uint8Array }>();
  for (let i = 0; i < sigs.length; i += 10) {
    const txs = await Promise.all(sigs.slice(i, i + 10).map((s) => rollup.getTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" })));
    for (const tx of txs) {
      for (const { name, data } of programEvents(program, tx?.meta?.logMessages ?? [])) {
        if (!data.player?.equals(player)) continue;
        if (name === "cardBought") bought.set(Number(data.cardId), { series: data.series, lockedPrice: BigInt(data.lockedPrice.toString()) });
        if (name === "cardRevealed") revealed.set(Number(data.cardId), { shares: BigInt(data.shares.toString()), seed: Uint8Array.from(data.seed) });
      }
    }
  }
  return [...revealed].flatMap(([id, r]) => (bought.has(id) ? [{ id, ...bought.get(id)!, ...r }] : [])).sort((a, b) => a.id - b.id);
}
