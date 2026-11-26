"use client";
import { useState } from "react";
import { explorerUrl, shortAddress, timeLeft, useGame } from "@scratchers/app-core";
import { money } from "@/lib/cards";

const ROW = "flex min-h-8 items-center justify-between gap-4 text-sm";
const BTN = "min-h-11 rounded-xl border border-[#3A3350] px-3 text-sm font-bold disabled:opacity-40";

/** Account dropdown. A native popover: the browser handles outside clicks, Escape and focus. */
export function ProfileMenu({ address, label, onLogout }: { address?: string; label?: string; onLogout: () => void }) {
  const g = useGame();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const a = g.account;
  const pending = g.cards.filter((c) => c.state === "claiming").length;
  const end = async () => {
    setErr(null);
    setBusy(true);
    try {
      await a!.endSession();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button popoverTarget="profile" className="flex min-h-11 items-center gap-2 rounded-full border border-[#3A3350] px-3.5 text-[13px]" aria-label="Your account">
        <span className="num">{address ? shortAddress(address) : "wallet…"}</span>
        <span aria-hidden="true" className="text-dim">▾</span>
      </button>
      <div id="profile" popover="auto" className="fixed bottom-auto left-auto right-[max(1rem,calc((100vw-80rem)/2+2rem))] top-16 m-0 max-h-[80dvh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-[#3A3350] bg-surface p-4 text-text shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-extrabold">{label ?? "Your account"}</span>
          <span className="num rounded-full border border-warn px-2 py-0.5 text-[10px] text-warn">DEVNET</span>
        </div>
        {address && (
          <div className="mt-2">
            <p className="num break-all text-[11px] text-dim">{address}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button className={BTN} onClick={() => navigator.clipboard.writeText(address).then(() => setCopied(true), () => setErr("Could not copy"))}>{copied ? "Copied ✓" : "Copy address"}</button>
              <a className={`${BTN} flex items-center justify-center`} href={explorerUrl(address)} target="_blank" rel="noreferrer">Explorer ↗</a>
            </div>
          </div>
        )}
        <div className="mt-3 border-t border-line pt-2">
          <div className={ROW}><span className="text-dim">Play balance</span><span className="num">{money(g.usdc)}</span></div>
          {a && <div className={ROW}><span className="text-dim">SOL for fees</span><span className="num">{a.sol.toFixed(3)}</span></div>}
          {g.holdings.map((h) => (
            <div key={h.ticker} className={ROW}><span className="text-dim">{h.ticker}</span><span className="num">{h.shares.toFixed(4)} · {money(h.shares * g.prices[h.feed])}</span></div>
          ))}
          {pending > 0 && <div className={ROW}><span className="text-dim">Payouts pending</span><span className="num text-warn">{pending}</span></div>}
        </div>
        {a && (
          <div className="mt-2 border-t border-line pt-3">
            <p className="text-sm font-bold">Play session</p>
            <p className="num mt-1 text-[11px] text-dim">{a.session ? `${timeLeft(a.session.expires)} left · ${money(a.session.capUsd)} spend limit` : "Not active on this device"}</p>
            {a.session && <button className={`${BTN} mt-2 w-full`} disabled={busy} onClick={end}>{busy ? "Ending…" : "End session"}</button>}
          </div>
        )}
        {err && <p role="alert" className="mt-2 text-xs text-danger">{err}</p>}
        <button className="mt-3 min-h-11 w-full rounded-xl border border-danger text-sm font-extrabold text-danger" onClick={onLogout}>Log out</button>
      </div>
    </>
  );
}
