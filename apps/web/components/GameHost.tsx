"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Keypair } from "@solana/web3.js";
import { SessionKeySigner } from "@scratchers/sdk";
import { ChainGameProvider, GameProvider, type Deployments } from "@scratchers/app-core";
import { usePrivySigner } from "@/lib/privySigner";

const chainMode = process.env.NEXT_PUBLIC_BACKEND === "chain";
const KEEPER = process.env.NEXT_PUBLIC_KEEPER_URL ?? "http://localhost:8787";

/** Session key lives in sessionStorage: survives reloads, dies with the tab (plan says in-memory; this avoids a wallet popup per reload). */
function useSessionKey(): SessionKeySigner | null {
  const [key, setKey] = useState<SessionKeySigner | null>(null);
  useEffect(() => {
    const raw = sessionStorage.getItem("scratchers-session-key");
    if (raw) return setKey(new SessionKeySigner(Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)))));
    const k = new SessionKeySigner();
    sessionStorage.setItem("scratchers-session-key", JSON.stringify(Array.from(k.keypair.secretKey)));
    setKey(k);
  }, []);
  return key;
}

function ChainHost({ children }: { children: ReactNode }) {
  const signer = usePrivySigner();
  const sessionKey = useSessionKey();
  const [dep, setDep] = useState<Deployments | null>(null);
  useEffect(() => {
    fetch("/deployments.json").then((r) => (r.ok ? r.json() : null)).then(setDep, () => setDep(null));
  }, []);
  const deps = useMemo(() => (signer && sessionKey && dep ? { signer, sessionKey, deployments: dep, keeperUrl: KEEPER } : null), [signer, sessionKey, dep]);
  // Logged out (or not deployed yet): the in-browser demo, so the app is never empty.
  if (!deps) return <GameProvider>{children}</GameProvider>;
  return <ChainGameProvider deps={deps}>{children}</ChainGameProvider>;
}

export function GameHost({ children, privy }: { children: ReactNode; privy: boolean }) {
  return chainMode && privy ? <ChainHost>{children}</ChainHost> : <GameProvider>{children}</GameProvider>;
}
