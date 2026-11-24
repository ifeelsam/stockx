"use client";
import { Buffer } from "buffer";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import type { ReactNode } from "react";
import { GameHost } from "@/components/GameHost";

// web3.js / anchor expect a global Buffer in the browser
if (typeof globalThis !== "undefined" && !(globalThis as { Buffer?: unknown }).Buffer) (globalThis as { Buffer?: unknown }).Buffer = Buffer;

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

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
      }}
    >
      <GameHost privy>{children}</GameHost>
    </PrivyProvider>
  );
}
