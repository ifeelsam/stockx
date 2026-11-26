import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Keypair } from "@solana/web3.js";
import * as SecureStore from "expo-secure-store";
import { SessionKeySigner } from "@scratchers/sdk";
import { ChainGameProvider, GameProvider } from "@scratchers/app-core";
import { colors } from "@scratchers/ui-tokens";
import deployments from "../../../../deployments/devnet.json"; // public addresses only
import { env } from "../env";
import { useWallet } from "./wallets";

const KEY = "session-key-v1";

/** The session key lives in the device keystore (shared with the Dev screen), never in JS storage. */
function useSessionKey(enabled: boolean): { key: SessionKeySigner | null; error: string | null } {
  const [key, setKey] = useState<SessionKeySigner | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    (async () => {
      const stored = await SecureStore.getItemAsync(KEY);
      if (stored) return setKey(new SessionKeySigner(Keypair.fromSecretKey(Buffer.from(stored, "base64"))));
      const k = new SessionKeySigner();
      await SecureStore.setItemAsync(KEY, Buffer.from(k.keypair.secretKey).toString("base64"));
      setKey(k);
    })().catch((e) => setError(String(e)));
  }, [enabled]);
  return { key, error };
}

/** A connected wallet always plays on chain. The in-app simulation is only for guests (or `EXPO_PUBLIC_BACKEND=mock`). */
export function GameHost({ children }: { children: ReactNode }) {
  const w = useWallet();
  const chain = env.backend === "chain" && !!w.signer;
  const { key: sessionKey, error } = useSessionKey(chain);
  const deps = useMemo(
    () => (chain && w.signer && sessionKey ? { signer: w.signer, sessionKey, deployments, keeperUrl: env.keeperUrl } : null),
    [chain, w.signer, sessionKey],
  );
  if (!chain) return <GameProvider>{children}</GameProvider>;
  // never stand in simulated balances for a real wallet while loading or after a failure
  if (!deps)
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", padding: 24 }}>
        {error ? <Text style={{ color: colors.danger }}>Could not open the session key: {error}</Text> : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  return <ChainGameProvider deps={deps}>{children}</ChainGameProvider>;
}
