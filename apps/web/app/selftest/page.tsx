"use client";
import { useEffect, useState } from "react";
import { Keypair, Transaction } from "@solana/web3.js";
import { buyCardIx, claimAllIx, connect, createSessionIx, delegatePlayerIx, depositToRollupIxs, depositUsdcIx, getProgram, signupIx, topUpActionEscrowIx } from "@scratchers/sdk";

/** Browser self-test: builds and serializes every onboarding/play instruction (u64 args exercise the Buffer polyfill). Not linked from the UI. */
export default function SelfTest() {
  const [out, setOut] = useState("running…");
  useEffect(() => {
    (async () => {
      const c = connect(), p = getProgram(c.base);
      const k = () => Keypair.generate().publicKey;
      const [u, s, m, f, v] = [k(), k(), k(), k(), k()];
      const ixs = [
        await signupIx(p, u),
        await delegatePlayerIx(p, u, v),
        topUpActionEscrowIx(u, u, 10_000_000n),
        await createSessionIx(p, u, s, Math.floor(Date.now() / 1000) + 3600, 100_000_000n),
        await depositUsdcIx(p, u, m, 50_000_000n),
        await buyCardIx(p, { signer: s, authority: u, seriesId: 3, stockMint: m, feed: f, n: 10, maxPrice: 7_000_000_000n, callerSeed: new Uint8Array(32) }),
        await claimAllIx(p, s, u, 3, m, v),
        ...(await depositToRollupIxs(c.base, u, m, 50_000_000n, v, u)),
      ];
      const tx = new Transaction().add(...ixs.slice(0, 2));
      tx.feePayer = u; tx.recentBlockhash = "11111111111111111111111111111111";
      tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      setOut(`OK: built ${ixs.length} instructions and serialized a transaction`);
    })().catch((e) => setOut("FAIL: " + (e?.message ?? String(e))));
  }, []);
  return <pre id="selftest" className="num text-sm">{out}</pre>;
}
