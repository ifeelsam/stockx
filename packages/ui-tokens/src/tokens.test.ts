import test from "node:test";
import assert from "node:assert/strict";
import { TIER_KEYS, TIERS, tierByMultiplier, tierByIndex } from "./index.js";

test("tier keys line up with the default rarity table", () => {
  assert.equal(TIER_KEYS.length, 8);
  assert.deepEqual([0.2, 1, 2, 5, 10, 50, 100, 1000].map((m) => tierByMultiplier(m).key), TIER_KEYS);
  assert.equal(tierByIndex(7), TIERS.grail);
  assert.equal(tierByIndex(99).key, "dust");
  assert.equal(TIERS.dust.fx, "none"); // Dust never celebrates
});
