"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGame } from "@scratchers/app-core";
import { LoginButton } from "./LoginButton";

const LINKS = [
  ["/play", "Play"],
  ["/portfolio", "Portfolio"],
  ["/prizes", "Prizes"],
  ["/verify", "Verify"],
  ["/dashboard", "Dashboard"],
];

export function Nav() {
  const path = usePathname();
  const g = useGame();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="font-black tracking-tight">
          <span className="text-accent">Stock</span> Scratchers
        </Link>
        <nav className="hidden gap-4 text-sm sm:flex">
          {LINKS.map(([h, l]) => (
            <Link key={h} href={h} className={path === h ? "text-text" : "text-dim hover:text-text"}>
              {l}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="num text-sm text-money" title="Rollup USDC balance">${g.usdc.toFixed(2)}</span>
          <LoginButton />
        </div>
      </div>
      <nav className="flex justify-around border-t border-line py-2 text-xs sm:hidden">
        {LINKS.map(([h, l]) => (
          <Link key={h} href={h} className={path === h ? "text-text" : "text-dim"}>
            {l}
          </Link>
        ))}
      </nav>
    </header>
  );
}
