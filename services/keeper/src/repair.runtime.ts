import { EventParser } from "@coral-xyz/anchor";
import { PublicKey, type Connection, type Keypair } from "@solana/web3.js";
import { CardState, markSettledIx, payOutIx, payoutPda, PROGRAM_ID, type ScratchersProgram } from "@scratchers/sdk";
import type { Deployments } from "./config.js";
import { log } from "./log.js";
import { planRepairs, type CardLite } from "./repair.js";
import { sendIx } from "./tx.js";

/**
 * Payout repair. Learn about claims from ClaimRequested events on the rollup, then (after a grace period)
 * make sure every ClaimRequested card has a Payout on Solana, calling pay_out when it does not and
 * mark_settled once it does. Idempotent: the Payout PDA makes pay_out exactly-once.
 */
export function startRepair(o: { program: ScratchersProgram; base: Connection; rollup: Connection; keeper: Keypair; deployments: Deployments; graceMs: number }) {
  const { program, base, rollup, keeper, deployments, graceMs } = o;
  const watched = new Set<string>(); // Player PDAs with unsettled claims
  const firstSeen = new Map<string, Map<bigint, number>>();
  // The sweep reads the committed base snapshot, which lags the rollup: remember what we already settled there.
  const settledHere = new Set<string>();
  const mintBySeries = new Map(deployments.series.map((s) => [s.id, new PublicKey(deployments.mints[s.stock])]));
  const parser = new EventParser(PROGRAM_ID, program.coder);

  rollup.onLogs(PROGRAM_ID, (l) => {
    for (const ev of parser.parseLogs(l.logs)) {
      if (ev.name === "claimRequested") watched.add((ev.data.player as PublicKey).toBase58());
    }
  }, "confirmed");

  // Best effort: after a restart, find players that already have unsettled claims.
  rollup.getProgramAccounts(PROGRAM_ID, { filters: [{ dataSize: program.account.player.size }] })
    .then((accs) => accs.forEach((a) => watched.add(a.pubkey.toBase58())))
    .catch((e) => log("warn", "player discovery unavailable; relying on events", { err: (e as Error).message }));

  async function sweep() {
    for (const key of [...watched]) {
      try {
        const info = await base.getAccountInfo(new PublicKey(key), "confirmed"); // committed snapshot
        if (!info) { watched.delete(key); continue; }
        const player = program.coder.accounts.decode("player", info.data);
        const cards = (player.cards as any[]).filter((c) => c.state === CardState.ClaimRequested && !settledHere.has(`${key}:${c.id}`));
        if (cards.length === 0) { watched.delete(key); firstSeen.delete(key); continue; }
        const payouts = await base.getMultipleAccountsInfo(cards.map((c) => payoutPda(new PublicKey(key), BigInt(c.id.toString()))));
        const lite: CardLite[] = cards.map((c, i) => ({ id: BigInt(c.id.toString()), state: c.state, seriesId: c.series, paidOut: payouts[i] !== null }));
        const seen = firstSeen.get(key) ?? new Map<bigint, number>();
        firstSeen.set(key, seen);
        for (const a of planRepairs(lite, seen, Date.now(), graceMs)) {
          if (a.kind === "pay_out") {
            const mint = mintBySeries.get(a.seriesId)!;
            const sig = await sendIx(base, keeper, [await payOutIx(program, keeper.publicKey, player.authority, a.seriesId, mint, a.cardId)]);
            log("info", "pay_out repaired", { player: key, card: a.cardId.toString(), sig });
          } else {
            try {
              const sig = await sendIx(rollup, keeper, [await markSettledIx(program, player.authority, a.cardId)]);
              log("info", "slot settled", { player: key, card: a.cardId.toString(), sig });
            } catch (e) {
              // 0x177f = BadState: the rollup copy is already Settled (our base snapshot is just stale)
              if (!/0x177f/.test((e as Error).message)) throw e;
            }
            settledHere.add(`${key}:${a.cardId}`);
          }
        }
      } catch (e) {
        log("error", "repair sweep failed", { player: key, err: (e as Error).message });
      }
    }
  }
  const t = setInterval(sweep, 5000);
  log("info", "payout repair started", { graceMs });
  return () => clearInterval(t);
}
