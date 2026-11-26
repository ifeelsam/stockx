import assert from "node:assert/strict";
import { test } from "node:test";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { statsPda, sell, sellToVaultIx, setSellQuoteIx, ackSoldIx, initSellQuoteIx, usdcForSale, paymentsSwapTx, sellQuotePda, depositUsdcIx, withdrawUsdcIx, treasuryUsdc, claimAllIx, escrowPda, magicFeeVaultPda, markSettledIx, payOutIx, payoutPda, topUpActionEscrowIx, buyCardIx, createSeriesIx, DEFAULT_TIERS, delegatePlayerIx, getProgram, programEvents, PROGRAM_ID, playerPda, rtp, sharesFor, signupIx, tierFor, totalWeight, vaultPda, VRF_EPHEMERAL_QUEUE } from "./index.js";

const program = getProgram(new Connection("http://127.0.0.1:8899"));
const seedWith = (r: bigint) => {
  const s = new Uint8Array(32);
  new DataView(s.buffer).setBigUint64(0, r, true);
  return s;
};

test("prize table: sums to 100,000 and RTP is exactly 75.371%", () => {
  assert.equal(totalWeight(DEFAULT_TIERS), 100_000);
  assert.equal(rtp(DEFAULT_TIERS), 0.75371);
  assert.equal(DEFAULT_TIERS.reduce((a, t) => a + t.multiplierBps * t.weight, 0), 753_710_000);
});

test("tierFor matches the Rust boundary vectors", () => {
  const vectors: [bigint, number][] = [[0n, 0], [76_024n, 0], [76_025n, 1], [88_524n, 1], [88_525n, 2], [96_857n, 2], [96_858n, 3], [98_857n, 3], [98_858n, 4], [99_857n, 4], [99_858n, 5], [99_957n, 5], [99_958n, 6], [99_997n, 6], [99_998n, 7], [99_999n, 7], [100_000n, 0]];
  for (const [r, tier] of vectors) assert.equal(tierFor(seedWith(r), DEFAULT_TIERS), tier, `r=${r}`);
});

test("sharesFor matches the Rust vectors", () => {
  assert.equal(sharesFor(10_000, 1_000_000n, 200n * 100_000_000n), 5_000n);
  assert.equal(sharesFor(10_000, 1_000_000n, 300n * 100_000_000n), 3_333n);
  assert.equal(sharesFor(0, 1_000_000n, 1n), 0n);
  // Plan §1: Dust (0.2×) on a $1 ticket at $412.35 is 0.000485 shares.
  assert.equal(sharesFor(2_000, 1_000_000n, 412_35_000_000n), 485n);
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

test("claim_all carries the fee vault, delegation record and magic accounts", async () => {
  const [authority, validator, mint] = [1, 2, 3].map(() => Keypair.generate().publicKey);
  const ix = await claimAllIx(program, authority, authority, 1, mint, validator);
  const keys = ix.keys.map((k) => k.pubkey.toBase58());
  assert.ok(keys.includes(magicFeeVaultPda(validator).toBase58()));
  assert.ok(keys.includes(playerPda(authority).toBase58()));
  assert.ok(ix.keys.find((k) => k.pubkey.equals(magicFeeVaultPda(validator)))!.isWritable);
});

test("escrow top-up targets the same escrow PDA the program checks", () => {
  const [payer, player] = [1, 2].map(() => Keypair.generate().publicKey);
  const ix = topUpActionEscrowIx(payer, player, 5_000_000n);
  assert.ok(ix.keys.some((k) => k.pubkey.equals(escrowPda(player))));
});

test("pay_out / mark_settled use the per-card Payout PDA", async () => {
  const [keeper, authority, mint] = [1, 2, 3].map(() => Keypair.generate().publicKey);
  const expected = payoutPda(playerPda(authority), 7n);
  const pay = await payOutIx(program, keeper, authority, 1, mint, 7n);
  assert.ok(pay.keys.some((k) => k.pubkey.equals(expected)));
  const mark = await markSettledIx(program, authority, 7n);
  assert.ok(mark.keys.some((k) => k.pubkey.equals(expected)));
});

test("deposit/withdraw name the owner's ATA and the Config-owned treasury", async () => {
  const [authority, usdc] = [1, 2].map(() => Keypair.generate().publicKey);
  const dep = await depositUsdcIx(program, authority, usdc, 5_000_000n);
  const keys = dep.keys.map((k) => k.pubkey.toBase58());
  assert.ok(keys.includes(treasuryUsdc(usdc).toBase58()));
  assert.ok(keys.includes(playerPda(authority).toBase58()));
  const wd = await withdrawUsdcIx(program, authority, usdc, 1n);
  assert.equal(wd.keys.length, dep.keys.length);
});

import { cardArt, FILLERS } from "./index.js";

const seedFrom = (n: number) => {
  const s = new Uint8Array(32);
  let x = n >>> 0 || 1;
  for (let i = 0; i < 32; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    s[i] = x >>> 24;
  }
  return s;
};
const count = (xs: string[], v: string) => xs.filter((x) => x === v).length;

test("cardArt: wins show exactly three matching tier symbols, Dust never shows a triple", () => {
  let wins = 0;
  for (let n = 1; n <= 3000; n++) {
    const art = cardArt(seedFrom(n));
    assert.equal(art.panels.length, 9);
    assert.equal(art.win, art.multiplierBps >= 10_000);
    const triples = new Set(art.panels.filter((p) => count(art.panels, p) >= 3));
    if (art.win) {
      wins++;
      assert.equal(triples.size, 1, `seed ${n}`);
      assert.equal(count(art.panels, [...triples][0]), 3);
      assert.deepEqual(art.winningPanels, art.panels.flatMap((p, i) => (p === [...triples][0] ? [i] : [])));
    } else {
      assert.equal(triples.size, 0, `seed ${n}`);
      assert.equal(art.winningPanels.length, 0);
    }
    for (const f of FILLERS) assert.ok(count(art.panels, f) <= 2);
  }
  assert.ok(wins > 620 && wins < 850, `win rate sanity: ${wins}/3000`); // ≈ 24% (Common and up)
});

test("cardArt output is pinned (web/mobile drift would break verified cards)", () => {
  const loss = Uint8Array.from({ length: 32 }, (_, i) => (i * 37 + 11) & 255);
  assert.deepEqual(cardArt(loss), {
    tier: 0, rarity: "Dust", multiplierBps: 2_000, multiplier: 0.2, win: false, winningPanels: [],
    panels: ["moon", "leaf", "fish", "wave", "fish", "wave", "key", "dice", "leaf"],
  });
  const fiveX = Uint8Array.from({ length: 32 }, (_, i) => (i * 31 + 3 * 31) & 255);
  assert.deepEqual(cardArt(fiveX), {
    tier: 3, rarity: "Rare", multiplierBps: 50_000, multiplier: 5, win: true, winningPanels: [1, 5, 8],
    panels: ["flame", "star", "dice", "dice", "leaf", "star", "moon", "leaf", "star"],
  });
  assert.deepEqual(cardArt(loss), cardArt(Uint8Array.from(loss)));
});

test("usdcForSale mirrors the program (spread, floor)", () => {
  assert.equal(usdcForSale(1_000_000n, 150n * 100_000_000n), 149_250_000n);
  assert.equal(usdcForSale(0n, 1n), 0n);
  // round trip never profits: $1 of TSLA bought at 248.31 sells for < $1
  const sh = sharesFor(10_000, 1_000_000n, 24_831_000_000n);
  assert.ok(usdcForSale(sh, 24_831_000_000n) < 1_000_000n);
});

test("sell instructions resolve every account", async () => {
  const [user, mint, usdc] = [Keypair.generate().publicKey, Keypair.generate().publicKey, Keypair.generate().publicKey];
  const ix = await sellToVaultIx(program, user, mint, usdc, 1_000_000n, 0n);
  const keys = ix.keys.map((k) => k.pubkey.toBase58());
  assert.ok(keys.includes(sellQuotePda(mint).toBase58()));
  assert.ok(keys.includes(vaultPda(mint).toBase58()));
  assert.equal(ix.keys.filter((k) => k.isSigner).length, 1);
  await setSellQuoteIx(program, user, mint, 1n, 1);
  await ackSoldIx(program, user, mint, 1n);
  await initSellQuoteIx(program, user, mint, usdc, 1n, 1);
});

test("sell() refuses the Payments API on devnet; paymentsSwapTx wires quote → swap", async () => {
  const [user, mint, usdc] = [Keypair.generate().publicKey, Keypair.generate().publicKey, Keypair.generate().publicKey];
  await assert.rejects(
    sell({ program, base: new Connection("http://127.0.0.1:8899"), signer: { publicKey: user, signTransaction: async (t) => t }, network: "devnet", stockMint: mint, usdcMint: usdc, shares: 1n, backend: "paymentsApi" }),
    /disabled on devnet/,
  );
  const calls: string[] = [];
  const fake = (async (url: string, init?: RequestInit) => {
    calls.push(String(url).split("?")[0].replace("https://x", ""));
    if (String(url).includes("/quote")) return new Response(JSON.stringify({ outAmount: "5" }));
    assert.equal(JSON.parse(String(init?.body)).visibility, "public");
    return new Response("", { status: 500 }); // stop after proving the swap request shape
  }) as typeof fetch;
  await assert.rejects(paymentsSwapTx({ baseUrl: "https://x", userPublicKey: user, inputMint: mint, outputMint: usdc, amount: 1n, slippageBps: 100, fetchImpl: fake }), /swap build failed: 500/);
  assert.deepEqual(calls, ["/v1/swap/quote", "/v1/swap/swap"]);
});

import { degradedServices } from "./status.js";
test("degradedServices flags only Down required services in our region", () => {
  const j = { environments: { devnet: { regions: {
    asia: { servers: { a: { live_status: { er: true, rpc_router: true, pricing_oracle: false, vrf_oracle: false } } } },
    usa: { servers: { u: { live_status: { er: false, rpc_router: true } } } },
    tee: { servers: { t: { live_status: { er: true } } } },
  } } } };
  assert.deepEqual(degradedServices(j, "devnet", "asia"), ["VRF randomness"], "pricing oracle ignored (own feed); N/A is not Down");
  assert.deepEqual(degradedServices(j, "devnet", "usa"), ["Ephemeral Rollup"]);
  assert.deepEqual(degradedServices(j, "devnet", "tee"), []);
  assert.deepEqual(degradedServices({}, "devnet", "asia"), []);
});

test("buyCardIx carries the series Stats account", async () => {
  const [u, m, f] = [Keypair.generate().publicKey, Keypair.generate().publicKey, Keypair.generate().publicKey];
  const ix = await buyCardIx(program, { signer: u, authority: u, seriesId: 3, stockMint: m, feed: f, n: 1, maxPrice: 1n, callerSeed: new Uint8Array(32) });
  assert.ok(ix.keys.some((k) => k.pubkey.equals(statsPda(3)) && k.isWritable));
});

import { Buffer as PolyBuffer } from "buffer/index.js"; // the npm polyfill, not Node builtin
import { patchBuffer } from "./index.js";
test("patchBuffer adds BigInt read/write to the buffer polyfill, matching Node", () => {
  patchBuffer(PolyBuffer as never);
  for (const v of [0n, 1n, 0xdeadbeefcafen, 2n ** 64n - 1n]) {
    for (const [w, r] of [["writeBigUInt64LE", "readBigUInt64LE"], ["writeBigUInt64BE", "readBigUInt64BE"]] as const) {
      const poly = PolyBuffer.alloc(10), node = Buffer.alloc(10);
      (poly as any)[w](v, 1); (node as any)[w](v, 1);
      assert.deepEqual([...poly], [...node], `${w} ${v}`);
      assert.equal((poly as any)[r](1), v);
    }
  }
  const s = PolyBuffer.alloc(8); (s as any).writeBigInt64LE(-2n);
  assert.equal(s.toString("hex"), Buffer.from(new BigInt64Array([-2n]).buffer).toString("hex"));
  assert.equal((s as any).readBigInt64LE(0), -2n);
});

test("patchBuffer reaches other Buffer copies (anything extending Uint8Array)", () => {
  patchBuffer();
  class Other extends Uint8Array {} // stands in for a bundler-injected second polyfill copy
  const o = new Other(8) as unknown as { writeBigUInt64LE(v: bigint, off: number): number; readBigUInt64LE(off: number): bigint };
  o.writeBigUInt64LE(1234567890123n, 0);
  assert.equal(o.readBigUInt64LE(0), 1234567890123n);
});

test("card history reads only events our program logged", () => {
  // a real devnet VrfCallback log line (CardRevealed)
  const data = "Program data: /FCT8IGR59BsaJfMsjfyj2buAjrqfcMy9WQ66CIuHwe53Kdt4FMbtBcAAAAAAAAAARAnAAAxCgAAAAAAAOYcOHNGxdKavZ5dsejq1sQm3Q5UdnqKIyTW1NeYR6kQ";
  const run = (id: string) => [`Program Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz invoke [1]`, `Program ${id} invoke [2]`, "Program log: Instruction: VrfCallback", data, `Program ${id} success`];
  assert.deepEqual(programEvents(program, run(PROGRAM_ID.toBase58())).map((e) => e.name), ["cardRevealed"]);
  assert.deepEqual(programEvents(program, run("Memo1111111111111111111111111111111111111")), [], "a look-alike line from another program is ignored");
});

test("patchBuffer keeps subarray() a Buffer where the engine drops the subclass (Hermes)", () => {
  class Hermes extends Uint8Array {
    static alloc(n: number) { return new Hermes(n); }
  }
  Hermes.prototype.subarray = function (this: Uint8Array, a?: number, b?: number) { return new Uint8Array(this.buffer, this.byteOffset, this.byteLength).subarray(a, b); } as typeof Hermes.prototype.subarray;
  assert.ok(!(Hermes.alloc(4).subarray(0) instanceof Hermes));
  patchBuffer(Hermes);
  const view = Hermes.alloc(4).subarray(1, 3);
  assert.ok(view instanceof Hermes);
  assert.equal(view.length, 2);
});
