import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Keypair } from "@solana/web3.js";
import * as SecureStore from "expo-secure-store";
import { SessionKeySigner } from "@scratchers/sdk";
import { ChainGameProvider, GameProvider, type Deployments } from "@scratchers/app-core";
import { env } from "../env";
import { useWallet } from "./wallets";

const KEY = "session-key-v1";

/** The session key lives in the device keystore (shared with the Dev screen), never in JS storage. */
function useSessionKey(enabled: boolean): SessionKeySigner | null {
  const [key, setKey] = useState<SessionKeySigner | null>(null);
  useEffect(() => {
    if (!enabled) return;
    (async () => {
      const stored = await SecureStore.getItemAsync(KEY);
      if (stored) return setKey(new SessionKeySigner(Keypair.fromSecretKey(Buffer.from(stored, "base64"))));
      const k = new SessionKeySigner();
      await SecureStore.setItemAsync(KEY, Buffer.from(k.keypair.secretKey).toString("base64"));
      setKey(k);
    })();
  }, [enabled]);
  return key;
}

/** Chain backend when `EXPO_PUBLIC_BACKEND=chain` and a wallet (Privy or Seeker) is connected; otherwise the demo. */
export function GameHost({ children }: { children: ReactNode }) {
  const w = useWallet();
  const chain = env.backend === "chain" && !!w.signer;
  const sessionKey = useSessionKey(chain);
  const [dep, setDep] = useState<Deployments | null>(null);
  useEffect(() => {
    if (!chain) return;
    fetch(`${env.keeperUrl}/deployments`).then((r) => (r.ok ? r.json() : null)).then(setDep, () => setDep(null));
  }, [chain]);
  const deps = useMemo(
    () => (chain && w.signer && sessionKey && dep ? { signer: w.signer, sessionKey, deployments: dep, keeperUrl: env.keeperUrl } : null),
    [chain, w.signer, sessionKey, dep],
  );
  if (!deps) return <GameProvider>{children}</GameProvider>;
  return <ChainGameProvider deps={deps}>{children}</ChainGameProvider>;
}
