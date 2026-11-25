import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { VISIBLE_SERIES, isPaused, seriesById, useGame } from "@scratchers/app-core";
import { colors, easing, timing, tierByMultiplier } from "@scratchers/ui-tokens";
import { HoloCard } from "../components/HoloCard";
import { JackpotOverlay } from "../components/JackpotOverlay";
import { CoinBurst } from "../components/CoinBurst";
import { CountUp } from "../components/CountUp";
import { ui } from "../theme";

export function Play() {
  const g = useGame();
  const [sid, setSid] = useState(11);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jackpot, setJackpot] = useState<number | null>(null);
  const [burst, setBurst] = useState<{ id: number; colors: string[]; count: number } | null>(null);
  const s = seriesById(sid);
  const paused = isPaused(g, s.feed);
  const live = g.cards.filter((c) => c.state !== "settled");
  const claimable = g.cards.filter((c) => c.state === "revealed");
  const sealed = claimable.filter((c) => c.art && !c.flipped);
  const winUsd = claimable.reduce((a, c) => a + c.shares * g.prices[seriesById(c.seriesId).feed], 0);
  const run = async (f: () => Promise<unknown>) => { setErr(null); setBusy(true); try { await f(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } };

  const best = (cs: typeof sealed) => [...cs].sort((a, b) => (b.art?.multiplierBps ?? 0) - (a.art?.multiplierBps ?? 0))[0];
  const celebrate = (c: (typeof live)[number]) => {
    const a = c.art!;
    const t = tierByMultiplier(a.multiplier);
    if (a.multiplierBps >= 10_000_000) setJackpot(c.shares * c.lockedPrice);
    else if (t.fx === "burst" || t.fx === "shake") setBurst({ id: c.id, colors: [t.color, t.glow, "#fff"], count: t.fx === "shake" ? 40 : 22 });
  };
  const flipAll = () => {
    if (!sealed.length) return;
    const top = best(sealed);
    for (const c of sealed) g.markFlipped(c.id);
    if (top?.art) {
      void import("../lib/fx").then((m) => m.revealFx(top.art!.multiplier));
      celebrate(top);
    }
  };

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={[ui.pad, { gap: 14, paddingBottom: 120 }]}>
        {g.setup && g.setup.status !== "ready" && (
          <View style={[ui.card, { borderColor: colors.gold + "66", backgroundColor: colors.gold + "14", gap: 8 }]}>
            <Text style={{ color: colors.gold, fontWeight: "800" }}>Set up your account</Text>
            <Text style={ui.dim}>One-time: create your player, delegate it to the rollup, start a play session{g.setup.step ? ` (next: ${g.setup.step})` : ""}.</Text>
            {g.setup.error && <Text style={{ color: colors.danger }}>{g.setup.error}</Text>}
            <Pressable disabled={busy || g.setup.status === "checking"} onPress={() => run(g.setup!.run)} style={[ui.btn, { backgroundColor: colors.gold, opacity: busy ? 0.4 : 1 }]}><Text style={ui.btnText}>{busy ? "Working…" : "Set up"}</Text></Pressable>
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {VISIBLE_SERIES.map((x) => {
            const on = x.id === sid;
            return (
              <Pressable key={x.id} onPress={() => setSid(x.id)} style={[ui.card, { width: 190, borderColor: on ? colors.accent : colors.line, backgroundColor: on ? colors.surfaceHi : colors.surface }]}>
                <View style={ui.row}>
                  <Text style={[ui.h2, { flex: 1 }]}>{x.name}</Text>
                  {x.demo && <Text style={{ color: colors.gold, fontSize: 10, fontWeight: "800" }}>DEMO ODDS</Text>}
                </View>
                <Text style={ui.mono}>{x.ticker} ${g.prices[x.feed].toFixed(2)}</Text>
                <Text style={[ui.dim, { fontSize: 12 }]}>{x.blurb}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[ui.row, { gap: 10, flexWrap: "wrap" }]}>
          <Pressable disabled={busy || paused} onPress={() => run(() => g.buy(sid, 1))} style={[ui.btn, { backgroundColor: colors.money, opacity: busy || paused ? 0.4 : 1 }]}><Text style={ui.btnText}>Rip 1 pack · ${s.ticketUsd}</Text></Pressable>
          <Pressable disabled={busy || paused} onPress={() => run(() => g.buy(sid, 10))} style={[ui.btn, { backgroundColor: colors.gold, opacity: busy || paused ? 0.4 : 1 }]}><Text style={ui.btnText}>Rip 10 · ${s.ticketUsd * 10}</Text></Pressable>
          <Pressable onPress={() => run(g.faucet)} style={[ui.btn, { borderColor: colors.line, borderWidth: 1 }]}><Text style={[ui.btnText, { color: colors.text, fontSize: 14 }]}>Get test funds</Text></Pressable>
        </View>
        {paused && <Text style={{ color: colors.warn }}>Price paused: waiting for a fresh print.</Text>}
        {err && <Text style={{ color: colors.danger }}>{err}</Text>}
        {live.length === 0 && <Text style={ui.dim}>No packs yet. Grab test funds, then rip a pack. Every card holds stock, even Dust.</Text>}

        {sealed.length > 0 && (
          <View style={[ui.card, { borderColor: colors.accent + "55", backgroundColor: colors.accent + "12" }]}>
            <Text style={{ color: colors.accent, fontWeight: "800" }}>{sealed.length} sealed card{sealed.length > 1 ? "s" : ""}</Text>
            <Text style={[ui.dim, { fontSize: 12, marginTop: 2 }]}>Tap a card to flip it. Dust stays plain; a glow means a real pull.</Text>
            <Pressable disabled={busy} onPress={flipAll} style={[ui.btn, { borderColor: colors.accent + "88", borderWidth: 1, paddingVertical: 8, marginTop: 8 }]}><Text style={{ color: colors.accent, fontWeight: "800", fontSize: 13 }}>Flip all</Text></Pressable>
          </View>
        )}

        {live.map((c, i) => {
          const cs = seriesById(c.seriesId);
          return (
            <Animated.View key={c.id} entering={FadeInDown.delay((i % 10) * timing.packStagger).springify().damping(easing.spring.damping).stiffness(easing.spring.stiffness)} style={{ alignItems: "center", gap: 6, marginBottom: 20 }}>
              <Text style={[ui.dim, { fontSize: 12 }]}>#{c.id} · {cs.ticker}{c.state === "claiming" ? " · settling…" : ""}</Text>
              {c.state === "pending" || !c.art ? (
                <View style={{ width: 300, height: 420, borderRadius: 26, backgroundColor: colors.surfaceHi, opacity: 0.6 }} />
              ) : (
                <>
                  <View>
                    <HoloCard
                      art={c.art}
                      flipped={c.flipped}
                      disabled={c.state === "claiming"}
                      cardId={c.id}
                      ticker={cs.ticker}
                      onDone={() => {
                        g.markFlipped(c.id);
                        celebrate(c);
                      }}
                    />
                    {burst?.id === c.id && <CoinBurst colors={burst.colors} count={burst.count} />}
                  </View>
                  {c.flipped && (
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ color: c.art.multiplierBps < 10_000 ? colors.textDim : tierByMultiplier(c.art.multiplier).color, fontWeight: "800", fontSize: 18 }}>
                        {c.art.multiplierBps < 10_000 ? "Dust · 20¢ back in " + cs.ticker : `${c.art.rarity} · ${tierByMultiplier(c.art.multiplier).payout}`}
                      </Text>
                      <View style={ui.row}>
                        <CountUp to={c.shares} prefix="" decimals={4} style={ui.dim} /><Text style={ui.dim}> {cs.ticker} ≈ </Text>
                        <CountUp to={c.shares * g.prices[cs.feed]} style={ui.dim} />
                      </View>
                    </View>
                  )}
                </>
              )}
            </Animated.View>
          );
        })}
      </ScrollView>

      {claimable.length > 0 && (
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 14 }}>
          <View>
            <Text style={ui.dim}>{claimable.length} card{claimable.length > 1 ? "s" : ""} holding stock</Text>
            <Text style={{ color: colors.money, fontWeight: "800", fontSize: 18 }}>≈ ${winUsd.toFixed(2)} in stock</Text>
          </View>
          <Pressable disabled={busy} onPress={() => run(g.claimAll)} style={[ui.btn, { backgroundColor: colors.money, opacity: busy ? 0.4 : 1 }]}><Text style={ui.btnText}>Claim all</Text></Pressable>
        </View>
      )}
      <JackpotOverlay open={jackpot !== null} usd={jackpot ?? 0} onClose={() => setJackpot(null)} />
    </View>
  );
}
