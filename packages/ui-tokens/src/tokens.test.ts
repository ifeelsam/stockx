import test from "node:test";
import assert from "node:assert/strict";
import { change, describeCard, TIER_KEYS, TIERS, tierByMultiplier, tierByIndex } from "./index.js";

test("card wording: Dust is never a win, big values drop cents, tiny moves are flat", () => {
  const s = { feed: "TSLA" as const, ticker: "mTSLA", ticketUsd: 1 };
  const card = (multiplier: number) => describeCard({ id: 7, art: { multiplier }, shares: 0.001, lockedPrice: 200 }, s, 200);
  assert.equal(card(0.2).caption.sub, "20¢ back in mTSLA");
  assert.doesNotMatch(JSON.stringify(card(0.2).caption), /\bup\b|\bwin/i);
  assert.match(card(1).caption.sub, /^money back/);
  assert.equal(card(1000).face.usd, "$1,000");
  assert.equal(change(-0.001).down, false);
  assert.equal(change(-0.01).down, true);
});

test("tier keys line up with the default rarity table", () => {
  assert.equal(TIER_KEYS.length, 8);
  assert.deepEqual([0.2, 1, 2, 5, 10, 50, 100, 1000].map((m) => tierByMultiplier(m).key), TIER_KEYS);
  assert.equal(tierByIndex(7), TIERS.grail);
  assert.equal(tierByIndex(99).key, "dust");
  assert.equal(TIERS.dust.fx, "none"); // Dust never celebrates
});
