import assert from "node:assert/strict";
import { test } from "node:test";
import { CardState } from "@scratchers/sdk";
import { Cooldown, DripBudget } from "./ratelimit.js";
import { isUsMarketOpen, planWalk, toFeedUnits } from "./prices.js";
import { planRepairs, type CardLite } from "./repair.js";

test("toFeedUnits rescales to the feed exponent and floors", () => {
  assert.deepEqual(toFeedUnits("25012345678", "12345", -8), { price: 25012345678n, conf: 12345n });
  assert.deepEqual(toFeedUnits("25012", "5", -2), { price: 25012000000n, conf: 5000000n }); // $250.12 at expo -2
  assert.deepEqual(toFeedUnits("250123456789", "99", -9), { price: 25012345678n, conf: 9n }); // expo -9 floors
});

test("US market hours in New York time", () => {
  assert.equal(isUsMarketOpen(new Date("2026-11-23T14:30:00Z")), true); // Mon 09:30 EST
  assert.equal(isUsMarketOpen(new Date("2026-11-23T14:29:00Z")), false);
  assert.equal(isUsMarketOpen(new Date("2026-11-23T21:00:00Z")), false); // 16:00 EST closed
  assert.equal(isUsMarketOpen(new Date("2026-11-22T17:00:00Z")), false); // Sunday
  assert.equal(isUsMarketOpen(new Date("2026-07-15T13:30:00Z")), true); // Wed 09:30 EDT
});

test("cooldown allows once per window per key", () => {
  const c = new Cooldown(1000);
  assert.equal(c.take("a", 0), 0);
  assert.equal(c.take("a", 400), 600);
  assert.equal(c.take("b", 400), 0);
  assert.equal(c.take("a", 1000), 0);
});

test("SOL drips stop at the hourly cap and above the funder's floor", () => {
  const b = new DripBudget(2, 1_000);
  assert.equal(b.take(5_000, 150, 0), true);
  assert.equal(b.take(5_000, 150, 1), true);
  assert.equal(b.take(5_000, 150, 2), false, "third drip in the hour");
  assert.equal(b.take(5_000, 150, 3_600_001), true, "the window slides");
  assert.equal(new DripBudget(9, 1_000).take(1_100, 150, 0), false, "would leave the funder under the floor");
});

test("repair planner waits out the grace period, repairs, then settles", () => {
  const seen = new Map<bigint, number>();
  const card = (over: Partial<CardLite>): CardLite => ({ id: 1n, state: CardState.ClaimRequested, seriesId: 1, paidOut: false, ...over });
  assert.deepEqual(planRepairs([card({})], seen, 0, 20_000), []); // first sighting
  assert.deepEqual(planRepairs([card({})], seen, 19_999, 20_000), []);
  assert.deepEqual(planRepairs([card({})], seen, 20_000, 20_000), [{ kind: "pay_out", cardId: 1n, seriesId: 1 }]);
  assert.deepEqual(planRepairs([card({ paidOut: true })], seen, 21_000, 20_000), [{ kind: "mark_settled", cardId: 1n }]);
  assert.deepEqual(planRepairs([card({ state: CardState.Settled })], seen, 22_000, 20_000), []);
  assert.equal(seen.has(1n), false);
});

test("planWalk stays inside the band and lands exactly on the target", () => {
  const band = 500; // 5%
  assert.deepEqual(planWalk(100n, 104n, band), [104n]); // within band: one step
  const up = planWalk(20_000_000_000n, 26_000_000_000n, band); // +30% gap
  assert.ok(up.length >= 5 && up.at(-1) === 26_000_000_000n);
  let prev = 20_000_000_000n;
  for (const p of up) {
    const diff = p > prev ? p - prev : prev - p;
    assert.ok(diff * 10_000n <= prev * BigInt(band), `step ${prev}->${p} exceeds the band`);
    prev = p;
  }
  const down = planWalk(26_000_000_000n, 20_000_000_000n, band);
  assert.equal(down.at(-1), 20_000_000_000n);
  assert.deepEqual(planWalk(0n, 5n, band), [5n]); // first push has no band
  // regression: a closed market repeats the same price; with no step the feed and quote silently went stale
  assert.deepEqual(planWalk(383_23000000n, 383_23000000n, band), [383_23000000n]);
});

import { planQuote } from "./quotes.js";
test("quotes follow fresh feed readings only", () => {
  const q = { ts: 1_000, priceE8: 100n };
  assert.equal(planQuote({ price: 5n, publishTs: 1_010 }, q, 1_020), "post");
  assert.equal(planQuote({ price: 5n, publishTs: 1_000 }, q, 1_020), "skip", "not newer than the quote");
  assert.equal(planQuote({ price: 5n, publishTs: 1_010 }, q, 1_100), "skip", "feed stale: market closed, let the quote expire");
  assert.equal(planQuote({ price: 0n, publishTs: 1_010 }, q, 1_020), "skip");
});

import { parseProRow } from "./prices.js";
test("pyth pro rows convert to feed units (-8) and seconds", () => {
  // TSLA live row: price 38313692 @ exp -5 → $383.13692; publish_time in µs
  const q = parseProRow("mTSLA", { price: 38313692, confidence: 11392, exponent: -5, publish_time: 1795541224000000 });
  assert.deepEqual([q.price, q.conf, q.publishTs], [38313692000n, 11392000n, 1795541224]);
  // SOL already at -8: unchanged
  assert.equal(parseProRow("mSOL", { price: 6922218555, exponent: -8, publish_time: 1_000_000 }).price, 6922218555n);
});

import { shouldHold } from "./prices.js";
test("hold-last-price applies only to feeds the source can serve, every 30 s", () => {
  const none = new Set<string>();
  assert.equal(shouldHold("mTSLA", undefined, 1_000_000, none), true);
  assert.equal(shouldHold("mTSLA", 1_000_000 - 10_000, 1_000_000, none), false, "recent push");
  assert.equal(shouldHold("mTSLA", 1_000_000 - 30_000, 1_000_000, none), true);
  assert.equal(shouldHold("mNVDA", undefined, 1_000_000, new Set(["mNVDA"])), false, "not entitled: stays paused");
  assert.equal(shouldHold("mNVDA", undefined, 1_000_000, new Set(["mNVDA"]), new Set(["mNVDA"])), true, "unless the operator asks to hold it");
});
