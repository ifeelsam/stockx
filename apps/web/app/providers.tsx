"use client";
import { Buffer } from "buffer";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import type { ReactNode } from "react";
import { ENDPOINTS, patchBuffer } from "@scratchers/sdk";
import { GameHost } from "@/components/GameHost";

// web3.js / anchor expect a global Buffer in the browser
if (typeof globalThis !== "undefined" && !(globalThis as { Buffer?: unknown }).Buffer) (globalThis as { Buffer?: unknown }).Buffer = Buffer;

patchBuffer(Buffer); // the browser Buffer polyfill lacks BigInt read/write that web3.js/anchor use for u64

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// Privy throws "No RPC configuration found" when signing unless the chain we pass has one.
const devnet = ENDPOINTS.devnet.base;
const rpcs = { "solana:devnet": { rpc: createSolanaRpc(devnet), rpcSubscriptions: createSolanaRpcSubscriptions(devnet.replace(/^http/, "ws")) } };

export function Providers({ children }: { children: ReactNode }) {
  if (!appId) return <GameHost privy={false}>{children}</GameHost>;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google"],
        appearance: { theme: "dark", accentColor: "#19E39A", walletChainType: "solana-only" },
        embeddedWallets: { solana: { createOnLogin: "users-without-wallets" } },
        externalWallets: { solana: { connectors: toSolanaWalletConnectors() } },
        solana: { rpcs },
      }}
    >
      <GameHost privy>{children}</GameHost>
    </PrivyProvider>
  );
}
