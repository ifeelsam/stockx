import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Connection, Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { connect, DEFAULT_TIERS, multiplierOf, SessionKeySigner, totalWeight } from "@scratchers/sdk";
import { cardUsd, colors, oddsText, SPLASH, TIERS, TIER_KEYS, type TierKey } from "@scratchers/ui-tokens";
import { RaritySplash } from "../components/RaritySplash";
import { env } from "../env";
import { ui } from "../theme";
import { useWallet } from "../lib/wallets";

const KEY = "session-key-v1";

/** Session key lives in the device keystore, never in JS storage or git. */
async function loadSessionKey(): Promise<SessionKeySigner> {
  const stored = await SecureStore.getItemAsync(KEY);
  if (stored) return new SessionKeySigner(Keypair.fromSecretKey(Buffer.from(stored, "base64")));
  const s = new SessionKeySigner();
  await SecureStore.setItemAsync(KEY, Buffer.from(s.keypair.secretKey).toString("base64"));
  return s;
}

const selfTransfer = async (conn: Connection, who: import("@scratchers/sdk").Signer["publicKey"]) => {
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: who, toPubkey: who, lamports: 0 }));
  tx.feePayer = who;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  return tx;
};

/** Day-1 risk test: both wallets sign, a session key signs and reaches the rollup endpoint. */
export function Dev() {
  const w = useWallet();
  const [splash, setSplash] = useState<TierKey | null>(null);
  const closeSplash = useCallback(() => setSplash(null), []);
  const [log, setLog] = useState<string[]>([]);
  const add = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString()} ${s}`, ...l].slice(0, 30));
  const run = (label: string, f: () => Promise<string>) => async () => {
    try { add(`${label}: ${await f()}`); } catch (e) { add(`${label} FAILED: ${e instanceof Error ? e.message : String(e)}`); }
  };
  const base = new Connection(env.baseRpc, "confirmed");

  const signWith = run(`sign (${w.kind})`, async () => {
    if (!w.signer) throw new Error("no signer (guest mode)");
    const signed = await w.signer.signTransaction(await selfTransfer(base, w.signer.publicKey));
    const sig = (signed as Transaction).signatures.find((s) => s.publicKey.equals(w.signer!.publicKey))?.signature;
    return sig ? `signed ✓ ${Buffer.from(sig).toString("hex").slice(0, 16)}…` : "returned without a signature";
  });
  const sessionToRollup = run("session key → rollup", async () => {
    const key = await loadSessionKey();
    const c = connect();
    const tx = await selfTransfer(c.rollup, key.publicKey);
    await key.signTransaction(tx);
    try {
      const sig = await c.rollup.sendRawTransaction(tx.serialize());
      return `landed ${sig.slice(0, 16)}… (${c.rollup.rpcEndpoint})`;
    } catch (e) {
      // an RPC-level rejection still proves the signed tx reached the rollup endpoint
      return `reached ${c.rollup.rpcEndpoint}; rollup said: ${(e instanceof Error ? e.message : String(e)).slice(0, 140)}`;
    }
  });
  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.pad, { gap: 10 }]}>
      <Text style={ui.h1}>Dev · risk test</Text>
      <Text style={ui.dim}>wallet: {w.kind} {w.address ?? ""} · seeker wallet: {w.availability}</Text>
      <Pressable onPress={signWith} style={[ui.btn, { backgroundColor: colors.money }]}><Text style={ui.btnText}>Sign tx with active wallet</Text></Pressable>
      <Pressable onPress={sessionToRollup} style={[ui.btn, { backgroundColor: colors.gold }]}><Text style={ui.btnText}>Session key → rollup tx</Text></Pressable>
      <Text style={[ui.h2, { marginTop: 10 }]}>Rarity splashes</Text>
      <Text style={ui.dim}>Preview only: nothing is bought or drawn.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {TIER_KEYS.filter((k) => SPLASH[k]).map((k) => (
          <Pressable key={k} onPress={() => setSplash(k)} accessibilityLabel={`Preview ${TIERS[k].label} splash`} style={[ui.btn, { borderWidth: 1, borderColor: TIERS[k].color }]}>
            <Text style={[ui.ghostText, { color: TIERS[k].color }]}>{TIERS[k].label}</Text>
          </Pressable>
        ))}
      </View>
      {splash && (() => {
        const i = TIER_KEYS.indexOf(splash);
        const m = multiplierOf(DEFAULT_TIERS[i]);
        return <RaritySplash rarity={splash} feed="TSLA" mult={`${m.toLocaleString("en-US")}×`} usd={cardUsd(m)} odds={oddsText(DEFAULT_TIERS[i].weight, totalWeight(DEFAULT_TIERS))} onClose={closeSplash} />;
      })()}
      <View style={ui.card}>{log.length === 0 ? <Text style={ui.dim}>no events yet</Text> : log.map((l, i) => <Text key={i} style={[ui.dim, { fontSize: 12 }]}>{l}</Text>)}</View>
    </ScrollView>
  );
}
