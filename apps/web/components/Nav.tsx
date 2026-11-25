"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGame } from "@scratchers/app-core";
import { LoginButton } from "./LoginButton";
import { money } from "@/lib/cards";

const LINKS = [
  ["/", "Packs"],
  ["/portfolio", "Binder"],
  ["/verify", "Proof"],
];

export function Nav() {
  const path = usePathname();
  const g = useGame();
  const [funding, setFunding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const active = (h: string) => (h === "/" ? path === "/" || path === "/play" : path === h);
  const addFunds = async () => {
    setErr(null);
    setFunding(true);
    try {
      await g.faucet();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setFunding(false);
    }
  };
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-8">
        <Link href="/" className="text-[22px] font-extrabold tracking-tight">ripStokx</Link>
        <nav aria-label="Main" className="order-3 flex w-full justify-center gap-1 sm:order-none sm:w-auto">
          {LINKS.map(([h, l]) => (
            <Link key={h} href={h} aria-current={active(h) ? "page" : undefined} className={`flex min-h-11 items-center rounded-full px-4 text-[15px] ${active(h) ? "bg-text font-extrabold text-ink" : "font-semibold text-[#C9C2E6]"}`}>
              {l}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <span className="num flex min-h-11 items-center rounded-full border border-[#3A3350] px-3.5 text-[13px] font-bold" title="Mock USDC on the rollup">{money(g.usdc)} USDC</span>
          <button onClick={addFunds} disabled={funding} className="min-h-11 rounded-full bg-accent px-4 text-sm font-extrabold text-ink disabled:opacity-50" title="Devnet faucet: +100 mock USDC">
            {funding ? "Adding…" : "Add funds"}
          </button>
          <LoginButton />
        </div>
      </div>
      {err && <p role="alert" className="px-4 pb-2 text-center text-sm text-danger">{err}</p>}
    </header>
  );
}
