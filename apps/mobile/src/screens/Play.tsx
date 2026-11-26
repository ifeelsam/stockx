import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { multiplierOf, totalWeight } from "@scratchers/sdk/pure";
import { isPaused, seriesById, useGame, VISIBLE_SERIES, type UiCard } from "@scratchers/app-core";
import { cardUsd, colors, describeCard, money, oddsText, TIERS, TIER_KEYS } from "@scratchers/ui-tokens";
import { CardBack, Gem, HoloCard } from "../components/HoloCard";
import { HoloPack } from "../components/HoloPack";
import { PackRip } from "../components/PackRip";
import { JackpotOverlay } from "../components/JackpotOverlay";
import { RaritySplash } from "../components/RaritySplash";
import { Deck, DECK_W } from "../components/Deck";
import { CountUp } from "../components/CountUp";
import { revealFx } from "../lib/fx";
import { font, ui } from "../theme";
import { Prizes } from "./Prizes";

const RIP_MS = 1350;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Shown = UiCard & { art: NonNullable<UiCard["art"]> };

const Chevron = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 5l-7 7 7 7" />
  </Svg>
);

/** Packs: the shop, the sealed pack, then the pulled cards as a deck. */
export function Play({ onProof, onBinder }: { onProof: (id: number) => void; onBinder: () => void }) {
  const g = useGame();
  const { width } = useWindowDimensions();
  const [view, setView] = useState<"shop" | "open" | "odds">("shop");
  const [sid, setSid] = useState(11);
  const [count, setCount] = useState<1 | 10>(10);
  const [another, setAnother] = useState(false);
  const [active, setActive] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [grail, setGrail] = useState<Shown | null>(null);
  const [splash, setSplash] = useState<Shown | null>(null);
  const [ripping, setRipping] = useState(false);
  const swipe = useRef<(() => void) | null>(null);
  const shelf = useRef<ComponentRef<typeof ScrollView>>(null);

  const s = seriesById(sid);
  const paused = isPaused(g, s.feed);
  const live = g.cards.filter((c) => c.state !== "settled");
  const sealed = ripping || another || live.length === 0;
  const cur = live[active] as UiCard | undefined;
  const atSummary = active >= live.length;

  const run = async (f: () => Promise<unknown>) => {
    setErr(null);
    setBusy(true);
    try {
      await f();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  // a card turns up when it reaches the top of the deck; Uncommon and better get their splash first
  useEffect(() => {
    if (view !== "open" || sealed || !cur?.art || cur.flipped || cur.state !== "revealed") return;
    g.markFlipped(cur.id);
    void revealFx(cur.art.multiplier);
    if (cur.art.multiplierBps >= 20_000) setSplash(cur as Shown);
  }, [view, sealed, cur?.id, cur?.state, cur?.flipped]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeSplash = useCallback(() => {
    setSplash((c) => {
      // the Grail also gets its own screen, with the proof link
      if (c && c.art.multiplierBps >= 10_000_000) setGrail(c);
      return null;
    });
  }, []);

  const rip = async () => {
    const start = live.length; // the new pack goes under nothing: it starts after any cards still unclaimed
    setRipping(true);
    const [ok] = await Promise.all([run(() => g.buy(sid, count)), sleep(RIP_MS)]);
    if (ok) {
      setActive(start);
      setAnother(false);
    }
    setRipping(false);
  };

  const skipDust = () => {
    let j = active + 1;
    while (j < live.length && live[j].art && live[j].art!.multiplierBps < 10_000) j++;
    for (const c of live.slice(active, j)) if (c.art && !c.flipped) g.markFlipped(c.id);
    setActive(j);
  };
  const open = (n: 1 | 10) => {
    setCount(n);
    setView("open");
  };

  if (view === "odds")
    return (
      <View style={ui.screen}>
        <Pressable onPress={() => setView("shop")} style={[ui.row, { gap: 8, padding: 16 }]}><Chevron /><Text style={ui.strong}>Packs</Text></Pressable>
        <Prizes />
      </View>
    );

  const setupCard = g.setup && g.setup.status !== "ready" && (
    <View style={[ui.card, { marginHorizontal: 20, marginTop: 12, borderColor: colors.accent + "66", gap: 8 }]}>
      <Text style={[ui.strong, { color: colors.accent }]}>Set up your account</Text>
      <Text style={ui.dim}>One time: create your player, delegate it to the rollup, start a play session{g.setup.step ? ` (next: ${g.setup.step})` : ""}.</Text>
      {g.setup.error && <Text style={{ color: colors.danger }}>{g.setup.error}</Text>}
      <Pressable disabled={busy || g.setup.status === "checking"} onPress={() => run(g.setup!.run)} style={[ui.btn, ui.primary, { opacity: busy ? 0.4 : 1 }]}><Text style={ui.btnText}>{busy ? "Working…" : "Set up"}</Text></Pressable>
    </View>
  );

  if (view === "shop")
    return (
      <View style={ui.screen}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {setupCard}
          {err && <Text style={{ color: colors.danger, marginHorizontal: 20 }}>{err}</Text>}
          <Text style={[ui.h1, { fontSize: 40, lineHeight: 42, marginHorizontal: 20, marginTop: 16 }]}>Rip a pack.{"\n"}Pull real stock.</Text>
          <ScrollView ref={shelf} contentOffset={{ x: VISIBLE_SERIES.findIndex((x) => x.id === sid) * 236, y: 0 }} horizontal showsHorizontalScrollIndicator={false} snapToInterval={236} decelerationRate="fast" contentContainerStyle={{ gap: 16, paddingHorizontal: (width - 220) / 2, paddingVertical: 26 }}
            onMomentumScrollEnd={(e) => setSid(VISIBLE_SERIES[Math.max(0, Math.min(VISIBLE_SERIES.length - 1, Math.round(e.nativeEvent.contentOffset.x / 236)))].id)}>
            {VISIBLE_SERIES.map((x, i) => (
              <Pressable key={x.id} onPress={() => { setSid(x.id); shelf.current?.scrollTo({ x: i * 236, animated: true }); }} accessibilityLabel={`Choose the ${x.name}`} style={{ opacity: x.id === sid ? 1 : 0.6, transform: [{ scale: x.id === sid ? 1 : 0.88 }] }}>
                <HoloPack feed={x.feed} demo={x.demo} paused={isPaused(g, x.feed)} />
              </Pressable>
            ))}
          </ScrollView>
          <View style={[ui.row, { justifyContent: "center", gap: 6 }]}>
            {VISIBLE_SERIES.map((x) => <View key={x.id} style={{ width: x.id === sid ? 22 : 6, height: 6, borderRadius: 3, backgroundColor: x.id === sid ? colors.accent : "#3A3350" }} />)}
          </View>
          {live.length > 0 && (
            <Pressable onPress={() => { setAnother(false); setView("open"); }} style={[ui.btn, ui.ghost, { marginHorizontal: 20, marginTop: 18 }]}><Text style={ui.ghostText}>You have {live.length} card{live.length > 1 ? "s" : ""} waiting →</Text></Pressable>
          )}
          <Text style={[ui.h2, { marginHorizontal: 20, marginTop: 24 }]}>What's inside {s.feed}{s.demo ? " · demo odds" : ""}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingTop: 14 }}>
            {TIER_KEYS.map((k, i) => {
              const m = multiplierOf(s.tiers[i]);
              const odds = oddsText(s.tiers[i].weight, totalWeight(s.tiers));
              return (
                <View key={k} style={{ gap: 4 }}>
                  <HoloCard feed={s.feed} rarity={k} mult={`${m.toLocaleString("en-US")}×`} usd={cardUsd(m * s.ticketUsd)} shares={odds} serial="——" tilt={(0.15 + i * 0.12) % 1} width={104} />
                  <Text style={{ fontFamily: font.heavy, fontSize: 13, color: TIERS[k].color }}>{TIERS[k].label} {m.toLocaleString("en-US")}×</Text>
                  <Text style={[ui.mono, { fontSize: 10, color: colors.textDim }]}>{odds}</Text>
                </View>
              );
            })}
          </ScrollView>
          <Text style={[ui.mono, { fontSize: 11, color: colors.textDim, marginHorizontal: 20, marginTop: 12 }]}>Most cards are Dust: 20¢ back in stock, a partial refund, not a win. Odds are frozen on chain before the first pack sells.</Text>
          <Pressable onPress={() => setView("odds")} style={{ paddingHorizontal: 20, paddingVertical: 14 }}><Text style={[ui.strong, { color: colors.accent }]}>Full rarity table →</Text></Pressable>
        </ScrollView>
        <View style={[ui.row, { gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderColor: colors.line }]}>
          {paused ? (
            <View style={[ui.btn, { flex: 1, borderWidth: 1, borderStyle: "dashed", borderColor: colors.accent }]}><Text style={[ui.ghostText, { color: colors.accent }]}>Price paused</Text></View>
          ) : (
            <>
              <Pressable onPress={() => { setAnother(true); open(10); }} style={[ui.btn, ui.primary, { flex: 1 }]}><Text style={ui.btnText}>Rip {s.feed} · ${s.ticketUsd * 10}</Text></Pressable>
              <Pressable onPress={() => { setAnother(true); open(1); }} style={[ui.btn, ui.ghost]}><Text style={ui.ghostText}>1 card · ${s.ticketUsd}</Text></Pressable>
            </>
          )}
        </View>
      </View>
    );

  const views = live.map((c) => (c.art ? describeCard(c as Shown, seriesById(c.seriesId), g.prices[seriesById(c.seriesId).feed]) : null));
  const flipped = views.filter((v, i) => v && (live[i].flipped || live[i].state === "claiming")) as NonNullable<(typeof views)[number]>[];
  const total = flipped.reduce((a, v) => a + v.usd, 0);
  const best = flipped.length ? flipped.reduce((a, b) => (b.usd > a.usd ? b : a)) : null;
  const v = views[active];
  const claimable = live.filter((c) => c.state === "revealed");

  return (
    <View style={ui.screen}>
      <View style={[ui.row, { justifyContent: "space-between", paddingHorizontal: 12 }]}>
        <Pressable onPress={() => setView("shop")} accessibilityLabel="Back to packs" style={{ padding: 12 }}><Chevron /></Pressable>
        <Text style={[ui.mono, { color: colors.textDim }]}>{sealed ? `${s.feed} pack · ${count} card${count > 1 ? "s" : ""}` : atSummary ? `${s.feed} pack · done` : `card ${active + 1} / ${live.length} · swipe`}</Text>
      </View>
      {setupCard}
      {err && <Text accessibilityRole="alert" style={{ color: colors.danger, marginHorizontal: 20 }}>{err}</Text>}
      {sealed ? (
        <ScrollView contentContainerStyle={{ paddingTop: 20, paddingBottom: 30, alignItems: "center" }} scrollEnabled={false}>
          <PackRip feed={s.feed} count={count} demo={s.demo} paused={paused} ripping={ripping} price={money(s.ticketUsd * count)} onRip={rip} />
          {live.length > 0 && !ripping && <Pressable onPress={() => setAnother(false)} style={{ padding: 16 }}><Text style={ui.dim}>Back to your {live.length} cards</Text></Pressable>}
        </ScrollView>
      ) : (
        <>
          <View style={{ height: 420, paddingTop: 14 }}>
            {atSummary ? (
              <View style={{ width: DECK_W, height: 368, alignSelf: "center", borderRadius: 16, backgroundColor: colors.text, padding: 18 }}>
                <Text style={[ui.mono, { color: colors.ink, fontFamily: font.monoBold, fontSize: 11 }]}>{seriesById(live[0].seriesId).feed} PACK · {live.length} CARD{live.length > 1 ? "S" : ""}</Text>
                {best && best.usd > seriesById(live[0].seriesId).ticketUsd
                  ? <CountUp to={total} style={{ fontFamily: font.heavy, fontSize: 44, color: colors.ink, marginTop: 6 }} />
                  : <Text style={{ fontFamily: font.heavy, fontSize: 44, color: colors.ink, marginTop: 6 }}>{money(total)}</Text>}
                {[...TIER_KEYS].reverse().map((k) => {
                  const mine = flipped.filter((x) => x.tier.key === k);
                  if (!mine.length) return null;
                  return (
                    <View key={k} style={[ui.row, { gap: 8, minHeight: 28, borderBottomWidth: 1, borderColor: "#D9D4E6" }]}>
                      <Gem fill={TIERS[k].color} size={11} />
                      <Text style={{ fontFamily: font.bold, color: colors.ink }}>{TIERS[k].label}</Text>
                      <Text style={[ui.mono, { color: colors.ink, marginLeft: "auto" }]}>×{mine.length} · {money(mine.reduce((a, x) => a + x.usd, 0))}</Text>
                    </View>
                  );
                })}
                {best && <Text style={{ fontFamily: font.bold, color: colors.ink, marginTop: "auto" }}>Best pull: {best.tier.label} {best.face.mult}</Text>}
              </View>
            ) : (
              <Deck id={cur!.id} under={live.length - active - 1} controls={swipe} locked={!v} onNext={() => setActive((i) => i + 1)}>
                {v ? <HoloCard {...v.face} width={DECK_W} /> : <View accessibilityLabel="Randomness pending" style={{ opacity: 0.6 }}><CardBack width={DECK_W} /></View>}
              </Deck>
            )}
          </View>
          <View style={{ alignItems: "center", paddingHorizontal: 24, minHeight: 62 }}>
            <Text style={{ fontFamily: font.heavy, fontSize: 24, color: atSummary || !v ? colors.text : v.tier.color }}>
              {atSummary ? "Pack done" : !v ? "Drawing…" : v.caption.title}
            </Text>
            <Text style={[ui.mono, { color: "#C9C2E6", textAlign: "center" }]}>
              {atSummary ? "claim to move the stock into your wallet" : !v ? "randomness pending" : cur!.state === "claiming" ? "settling on Solana…" : v.tier.key === "dust" ? `${v.caption.sub} · swipe` : v.caption.sub}
            </Text>
          </View>
          <View accessibilityLabel={`${Math.min(active + 1, live.length)} of ${live.length} cards seen`} style={[ui.row, { justifyContent: "center", gap: 6, paddingTop: 12, flexWrap: "wrap" }]}>
            {live.slice(0, 16).map((c, i) => <View key={c.id} style={{ width: i === active ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i <= active && views[i] ? views[i]!.tier.color : "#3A3350" }} />)}
          </View>
          <View style={[ui.row, { gap: 10, paddingHorizontal: 20, paddingBottom: 18, marginTop: "auto" }]}>
            {atSummary ? (
              <>
                <Pressable onPress={() => setAnother(true)} style={[ui.btn, ui.ghost, { flex: 1, paddingHorizontal: 6 }]}><Text numberOfLines={1} adjustsFontSizeToFit style={ui.ghostText}>Rip another</Text></Pressable>
                <Pressable disabled={busy || !claimable.length} onPress={() => run(g.claimAll).then((ok) => ok && onBinder())} style={[ui.btn, ui.primary, { flex: 1.4, opacity: busy || !claimable.length ? 0.4 : 1 }]}><Text style={ui.btnText}>{busy ? "Working…" : "Add all to binder"}</Text></Pressable>
              </>
            ) : (
              <>
                <Pressable disabled={!v} onPress={() => swipe.current?.()} style={[ui.btn, { flex: 1, backgroundColor: colors.text, opacity: v ? 1 : 0.4 }]}>
                  <Text style={ui.btnText}>{active === live.length - 1 ? "See the pack total" : "Next card"}</Text>
                </Pressable>
                <Pressable onPress={skipDust} style={[ui.btn, ui.ghost]}><Text style={ui.ghostText}>Skip Dust</Text></Pressable>
              </>
            )}
          </View>
        </>
      )}
      {splash && (() => {
        const ss = seriesById(splash.seriesId);
        const d = describeCard(splash, ss, 0);
        return <RaritySplash rarity={d.tier.key} feed={ss.feed} mult={d.face.mult} usd={d.face.usd} odds={`${ss.demo ? "DEMO ODDS · " : ""}${oddsText(ss.tiers[splash.art.tier].weight, totalWeight(ss.tiers))}`} onClose={closeSplash} />;
      })()}
      <JackpotOverlay card={grail} onClose={() => setGrail(null)} onProof={(id) => { setGrail(null); onProof(id); }} onClaim={() => { setGrail(null); void run(g.claimAll); }} />
    </View>
  );
}
