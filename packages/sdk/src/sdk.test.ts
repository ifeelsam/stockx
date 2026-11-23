import assert from "node:assert/strict";
import { test } from "node:test";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { buyCardIx, createSeriesIx, DEFAULT_TIERS, delegatePlayerIx, getProgram, PROGRAM_ID, playerPda, rtp, sharesFor, signupIx, tierFor, totalWeight, vaultPda, VRF_EPHEMERAL_QUEUE } from "./index.js";

const program = getProgram(new Connection("http://127.0.0.1:8899"));
const seedWith = (r: bigint) => {
  const s = new Uint8Array(32);
  new DataView(s.buffer).setBigUint64(0, r, true);
  return s;
};

test("prize table: sums to 100,000 and RTP is exactly 76%", () => {
  assert.equal(totalWeight(DEFAULT_TIERS), 100_000);
  assert.equal(rtp(DEFAULT_TIERS), 0.76);
});

test("tierFor matches the Rust boundary vectors", () => {
  const vectors: [bigint, number][] = [[0n, 0], [61_857n, 0], [61_858n, 1], [86_858n, 2], [96_858n, 3], [98_858n, 4], [99_858n, 5], [99_958n, 6], [99_997n, 6], [99_998n, 7], [99_999n, 7], [100_000n, 0]];
  for (const [r, tier] of vectors) assert.equal(tierFor(seedWith(r), DEFAULT_TIERS), tier, `r=${r}`);
});

test("sharesFor matches the Rust vectors", () => {
  assert.equal(sharesFor(1, 1_000_000n, 200n * 100_000_000n), 5_000n);
  assert.equal(sharesFor(1, 1_000_000n, 300n * 100_000_000n), 3_333n);
  assert.equal(sharesFor(0, 1_000_000n, 1n), 0n);
});

test("PDA helpers agree with the IDL's own seed resolution", async () => {
  const authority = Keypair.generate().publicKey;
  const ix = await signupIx(program, authority);
  assert.ok(ix.keys.some((k) => k.pubkey.equals(playerPda(authority))));
  assert.ok(ix.programId.equals(PROGRAM_ID));
});

test("delegate_player resolves the delegation accounts", async () => {
  const authority = Keypair.generate().publicKey;
  const ix = await delegatePlayerIx(program, authority, Keypair.generate().publicKey);
  assert.equal(ix.keys.length, 8); // authority + buffer/record/metadata + player + owner/delegation/system programs
  assert.ok(ix.keys.every((k) => k.pubkey));
});

test("buy_card builds with the VRF accounts and rejects bad input", async () => {
  const [authority, mint, feed] = [1, 2, 3].map(() => Keypair.generate().publicKey);
  const ix = await buyCardIx(program, { signer: authority, authority, seriesId: 1, stockMint: mint, feed, n: 10, maxPrice: 1n, callerSeed: new Uint8Array(32) });
  const keys = ix.keys.map((k) => k.pubkey.toBase58());
  assert.ok(keys.includes(VRF_EPHEMERAL_QUEUE.toBase58()));
  assert.ok(keys.includes(vaultPda(mint).toBase58()));
  await assert.rejects(async () => buyCardIx(program, { signer: authority, authority, seriesId: 1, stockMint: mint, feed, n: 11, maxPrice: 1n, callerSeed: new Uint8Array(32) }));
});

test("create_series requires 8 tier slots", async () => {
  const k = Keypair.generate().publicKey;
  await assert.rejects(async () => createSeriesIx(program, k, { id: 1, stockMint: k, source: "selfPushed", feed: k, feedExpo: -8, ticketUsdE6: 1_000_000n, tiers: DEFAULT_TIERS.slice(0, 3) }));
  const ix = await createSeriesIx(program, k, { id: 1, stockMint: k, source: "selfPushed", feed: PublicKey.default, feedExpo: -8, ticketUsdE6: 1_000_000n, tiers: DEFAULT_TIERS });
  assert.ok(ix.data.length > 8);
});
