import { CardState } from "@scratchers/sdk";

export type CardLite = { id: bigint; state: number; seriesId: number; paidOut: boolean };
export type RepairAction = { kind: "pay_out"; cardId: bigint; seriesId: number } | { kind: "mark_settled"; cardId: bigint };

/**
 * Pure planner. For each ClaimRequested card: if no Payout exists after `graceMs`, repair it with pay_out;
 * if the Payout exists, free the rollup slot with mark_settled. Exactly-once is enforced on-chain by the
 * Payout PDA, so re-planning is always safe.
 */
export function planRepairs(cards: CardLite[], firstSeenMs: Map<bigint, number>, now: number, graceMs: number): RepairAction[] {
  const out: RepairAction[] = [];
  for (const c of cards) {
    if (c.state !== CardState.ClaimRequested) {
      firstSeenMs.delete(c.id);
      continue;
    }
    if (c.paidOut) out.push({ kind: "mark_settled", cardId: c.id });
    else {
      const seen = firstSeenMs.get(c.id) ?? now;
      firstSeenMs.set(c.id, seen);
      if (now - seen >= graceMs) out.push({ kind: "pay_out", cardId: c.id, seriesId: c.seriesId });
    }
  }
  return out;
}

/** Wait after the n-th failed repair of one card: 10 s doubling to 10 min. A payout that can never land must not be retried every sweep. */
export const retryDelayMs = (fails: number) => Math.min(5000 * 2 ** fails, 600_000);
