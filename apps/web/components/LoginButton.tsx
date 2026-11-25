"use client";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";

export const hasPrivy = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function LoginButton() {
  if (!hasPrivy) return <span className="text-xs text-warn">Privy app id not set</span>;
  return <PrivyLogin />;
}

function PrivyLogin() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  if (!ready) return <span className="shim h-11 w-20 rounded-full bg-surface" />;
  if (!authenticated)
    return (
      <button onClick={login} className="min-h-11 rounded-full border border-accent px-4 text-sm font-extrabold text-accent">
        Log in
      </button>
    );
  const addr = wallets[0]?.address;
  return (
    <button onClick={logout} className="min-h-11 rounded-full border border-[#3A3350] px-3.5 text-[13px]" title="Log out">
      <span className="num">{addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : "wallet…"}</span>
    </button>
  );
}
