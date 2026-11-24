import { PublicKey, type Connection } from "@solana/web3.js";
import { playerPda, statsPda } from "./pda.js";
import type { ScratchersProgram } from "./program.js";

export const CardState = { Empty: 0, Paid: 1, RandomnessPending: 2, Revealed: 3, ClaimRequested: 4, Settled: 5, Cancelled: 6 } as const;
export const cardStateName = (s: number) => Object.entries(CardState).find(([, v]) => v === s)?.[0] ?? `Unknown(${s})`;

export type PlayerAccount = Awaited<ReturnType<ScratchersProgram["account"]["player"]["fetch"]>>;
export type CardAccount = PlayerAccount["cards"][number];

/** Fetch through the connection the program object is bound to (use a rollup-bound program for a delegated Player). */
export const fetchPlayer = (p: ScratchersProgram, authority: PublicKey) => p.account.player.fetch(playerPda(authority), "confirmed");

/** Live cards over the rollup websocket. Returns an unsubscribe function. */
export function subscribeCards(
  p: ScratchersProgram,
  rollup: Connection,
  authority: PublicKey,
  onChange: (player: PlayerAccount) => void,
): () => void {
  const id = rollup.onAccountChange(
    playerPda(authority),
    (info) => onChange(p.coder.accounts.decode("player", info.data) as PlayerAccount),
    "confirmed",
  );
  return () => void rollup.removeAccountChangeListener(id);
}

/** Live price over the rollup websocket (Path B feed). */
export function subscribePrice(
  p: ScratchersProgram,
  rollup: Connection,
  feed: PublicKey,
  onChange: (f: { price: bigint; conf: bigint; expo: number; publishTs: number }) => void,
): () => void {
  const id = rollup.onAccountChange(
    feed,
    (info) => {
      const f = p.coder.accounts.decode("priceFeed", info.data);
      onChange({ price: BigInt(f.price.toString()), conf: BigInt(f.conf.toString()), expo: f.expo, publishTs: f.publishTs.toNumber() });
    },
    "confirmed",
  );
  return () => void rollup.removeAccountChangeListener(id);
}

export type StatsAccount = Awaited<ReturnType<ScratchersProgram["account"]["stats"]["fetch"]>>;
/** Public per-series counters (read on the rollup connection while delegated). */
export const fetchStats = (p: ScratchersProgram, seriesId: number, connection?: Connection) =>
  p.account.stats.fetch(statsPda(seriesId), "confirmed");
