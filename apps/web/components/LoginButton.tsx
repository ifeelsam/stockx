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
  if (!ready) return <span className="h-8 w-20 rounded-lg shimmer" />;
  if (!authenticated)
    return (
      <button onClick={login} className="rounded-lg bg-money px-3 py-1.5 text-sm font-semibold text-ink hover:brightness-110">
        Log in
      </button>
    );
  const addr = wallets[0]?.address;
  return (
    <button onClick={logout} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-hi" title="Log out">
      <span className="num">{addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : "wallet…"}</span>
    </button>
  );
}
