import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SERIES, isEquity, seriesById, useGame } from "@scratchers/app-core";
import { colors, easing, timing, tierByMultiplier } from "@scratchers/ui-tokens";
import { ScratchCard } from "../components/ScratchCard";
import { JackpotOverlay } from "../components/JackpotOverlay";
import { CoinBurst } from "../components/CoinBurst";
import { CountUp } from "../components/CountUp";
import { ui } from "../theme";

export function Play() {
  const g = useGame();
  const [sid, setSid] = useState(3);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jackpot, setJackpot] = useState<number | null>(null);
  const [burst, setBurst] = useState<{ id: number; colors: string[]; count: number } | null>(null);
  const s = seriesById(sid);
  const paused = isEquity(s.feed) && g.marketClosed;
  const live = g.cards.filter((c) => c.state !== "settled");
  const claimable = g.cards.filter((c) => c.state === "revealed");
  const winUsd = claimable.reduce((a, c) => a + c.shares * g.prices[seriesById(c.seriesId).feed], 0);
  const run = async (f: () => Promise<unknown>) => { setErr(null); setBusy(true); try { await f(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } };

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={[ui.pad, { gap: 14, paddingBottom: 120 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {SERIES.map((x) => {
            const on = x.id === sid;
            return (
              <Pressable key={x.id} onPress={() => setSid(x.id)} style={[ui.card, { width: 190, borderColor: on ? colors.money : colors.line, backgroundColor: on ? colors.surfaceHi : colors.surface }]}>
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
          <Pressable disabled={busy || paused} onPress={() => run(() => g.buy(sid, 1))} style={[ui.btn, { backgroundColor: colors.money, opacity: busy || paused ? 0.4 : 1 }]}><Text style={ui.btnText}>Buy 1 · ${s.ticketUsd}</Text></Pressable>
          <Pressable disabled={busy || paused} onPress={() => run(() => g.buy(sid, 10))} style={[ui.btn, { backgroundColor: colors.gold, opacity: busy || paused ? 0.4 : 1 }]}><Text style={ui.btnText}>Buy 10 · ${s.ticketUsd * 10}</Text></Pressable>
          <Pressable onPress={() => run(g.faucet)} style={[ui.btn, { borderColor: colors.line, borderWidth: 1 }]}><Text style={[ui.btnText, { color: colors.text, fontSize: 14 }]}>Get test funds</Text></Pressable>
        </View>
        {paused && <Text style={{ color: colors.warn }}>Market closed: pick the SOL series.</Text>}
        {err && <Text style={{ color: colors.danger }}>{err}</Text>}
        {live.length === 0 && <Text style={ui.dim}>No cards yet. Grab test funds, then buy a pack.</Text>}

        {live.map((c, i) => {
          const cs = seriesById(c.seriesId);
          return (
            <Animated.View key={c.id} entering={FadeInDown.delay((i % 10) * timing.packStagger).springify().damping(easing.spring.damping).stiffness(easing.spring.stiffness)} style={{ alignItems: "center", gap: 6, marginBottom: 20 }}>
              <Text style={[ui.dim, { fontSize: 12 }]}>#{c.id} · {cs.ticker}{c.state === "claiming" ? " · settling…" : ""}</Text>
              {c.state === "pending" || !c.art ? (
                <View style={{ width: 300, height: 300, borderRadius: 20, backgroundColor: colors.surfaceHi, opacity: 0.6 }} />
              ) : (
                <>
                  <View>
                    <ScratchCard
                      art={c.art}
                      scratched={c.scratched}
                      disabled={c.state === "claiming"}
                      onDone={() => {
                        g.markScratched(c.id);
                        const t = tierByMultiplier(c.art!.multiplier);
                        if (c.art!.multiplier >= 1000) setJackpot(c.shares * c.lockedPrice);
                        else if (t.fx !== "none" && t.fx !== "glow") setBurst({ id: c.id, colors: [t.color, t.glow, "#fff"], count: t.fx === "shake" ? 40 : 22 });
                      }}
                    />
                    {burst?.id === c.id && <CoinBurst colors={burst.colors} count={burst.count} />}
                  </View>
                  {c.scratched && (
                    <View style={{ alignItems: "center" }}>
                      {c.art.win ? (
                        <>
                          <Text style={{ color: tierByMultiplier(c.art.multiplier).color, fontWeight: "800", fontSize: 18 }}>{tierByMultiplier(c.art.multiplier).label}</Text>
                          <View style={ui.row}>
                            <CountUp to={c.shares} prefix="" decimals={4} style={ui.dim} /><Text style={ui.dim}> {cs.ticker} ≈ </Text>
                            <CountUp to={c.shares * g.prices[cs.feed]} style={ui.dim} />
                          </View>
                        </>
                      ) : <Text style={ui.dim}>No win. Try again.</Text>}
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
            <Text style={ui.dim}>{claimable.length} card{claimable.length > 1 ? "s" : ""} ready</Text>
            <Text style={{ color: colors.money, fontWeight: "800", fontSize: 18 }}>≈ ${winUsd.toFixed(2)} in stock</Text>
          </View>
          <Pressable disabled={busy} onPress={() => run(g.claimAll)} style={[ui.btn, { backgroundColor: colors.money, opacity: busy ? 0.4 : 1 }]}><Text style={ui.btnText}>Claim all</Text></Pressable>
        </View>
      )}
      <JackpotOverlay open={jackpot !== null} usd={jackpot ?? 0} onClose={() => setJackpot(null)} />
    </View>
  );
}
