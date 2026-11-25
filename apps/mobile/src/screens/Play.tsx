import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { multiplierOf, totalWeight } from "@scratchers/sdk/pure";
import { isPaused, seriesById, useGame, VISIBLE_SERIES, type UiCard } from "@scratchers/app-core";
import { cardUsd, colors, describeCard, money, oddsText, TIERS, TIER_KEYS } from "@scratchers/ui-tokens";
import { CardBack, Gem, HoloCard } from "../components/HoloCard";
import { HoloPack } from "../components/HoloPack";
import { PackRip } from "../components/PackRip";
import { JackpotOverlay } from "../components/JackpotOverlay";
import { CoinBurst } from "../components/CoinBurst";
import { CountUp } from "../components/CountUp";
import { revealFx } from "../lib/fx";
import { font, ui } from "../theme";
import { Prizes } from "./Prizes";

const CW = 258;
const STEP = CW + 16;
type Shown = UiCard & { art: NonNullable<UiCard["art"]> };

/** Packs: the shop, the sealed pack, then one card at a time. */
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
  const [burst, setBurst] = useState<{ id: number; colors: string[]; count: number } | null>(null);
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);

  const s = seriesById(sid);
  const paused = isPaused(g, s.feed);
  const live = g.cards.filter((c) => c.state !== "settled");
  const sealed = another || live.length === 0;
  const cur = live[Math.min(active, live.length - 1)] as UiCard | undefined;
  const atSummary = active >= live.length;
  const isUp = !!cur && (cur.flipped || cur.state === "claiming");

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

  const flip = (cards: UiCard[]) => {
    const fresh = cards.filter((c): c is Shown => !!c.art && !c.flipped && c.state === "revealed");
    if (!fresh.length) return;
    for (const c of fresh) g.markFlipped(c.id);
    const best = fresh.reduce((a, b) => (b.art.multiplierBps > a.art.multiplierBps ? b : a));
    void revealFx(best.art.multiplier);
    const t = describeCard(best, seriesById(best.seriesId), 0).tier;
    if (best.art.multiplierBps >= 10_000_000) setGrail(best);
    else if (t.fx === "burst" || t.fx === "shake") setBurst({ id: best.id, colors: [t.color, t.glow, "#fff"], count: t.fx === "shake" ? 40 : 22 });
  };

  // design "swipe one by one": the card you land on turns over by itself once its result is in
  useEffect(() => {
    if (view !== "open" || sealed || !cur?.art || cur.flipped) return;
    const t = setTimeout(() => flip([cur]), 450);
    return () => clearTimeout(t);
  }, [view, sealed, cur?.id, cur?.state, cur?.flipped]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (i: number) => {
    setActive(i);
    pager.current?.scrollTo({ x: i * STEP, animated: true });
  };
  const open = (n: 1 | 10) => {
    setCount(n);
    setView("open");
  };

  if (view === "odds")
    return (
      <View style={ui.screen}>
        <Pressable onPress={() => setView("shop")} style={{ padding: 16 }}><Text style={ui.strong}>‹ Packs</Text></Pressable>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={236} decelerationRate="fast" contentContainerStyle={{ gap: 16, paddingHorizontal: (width - 220) / 2, paddingVertical: 26 }}
            onMomentumScrollEnd={(e) => setSid(VISIBLE_SERIES[Math.max(0, Math.min(VISIBLE_SERIES.length - 1, Math.round(e.nativeEvent.contentOffset.x / 236)))].id)}>
            {VISIBLE_SERIES.map((x) => (
              <Pressable key={x.id} onPress={() => setSid(x.id)} accessibilityLabel={`Choose the ${x.name}`} style={{ opacity: x.id === sid ? 1 : 0.6, transform: [{ scale: x.id === sid ? 1 : 0.88 }] }}>
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
  const v = views[Math.min(active, live.length - 1)];
  const claimable = live.filter((c) => c.state === "revealed");

  return (
    <View style={ui.screen}>
      <View style={[ui.row, { justifyContent: "space-between", paddingHorizontal: 12 }]}>
        <Pressable onPress={() => setView("shop")} accessibilityLabel="Back to packs" style={{ padding: 12 }}><Text style={[ui.strong, { fontSize: 22 }]}>‹</Text></Pressable>
        <Text style={[ui.mono, { color: colors.textDim }]}>{sealed ? `${s.feed} pack · ${count} card${count > 1 ? "s" : ""}` : atSummary ? "pack done" : `card ${active + 1} / ${live.length} · swipe`}</Text>
      </View>
      {setupCard}
      {err && <Text accessibilityRole="alert" style={{ color: colors.danger, marginHorizontal: 20 }}>{err}</Text>}
      {sealed ? (
        <ScrollView contentContainerStyle={{ paddingTop: 20, paddingBottom: 30, alignItems: "center" }}>
          <PackRip feed={s.feed} count={count} demo={s.demo} paused={paused} busy={busy} price={money(s.ticketUsd * count)}
            onRip={() => run(() => g.buy(sid, count)).then((ok) => { if (ok) { setActive(0); setAnother(false); } })} />
          {live.length > 0 && <Pressable onPress={() => setAnother(false)} style={{ padding: 16 }}><Text style={ui.dim}>Back to your {live.length} cards</Text></Pressable>}
        </ScrollView>
      ) : (
        <>
          <View style={{ height: 400 }}>
            <ScrollView ref={pager} horizontal showsHorizontalScrollIndicator={false} snapToInterval={STEP} decelerationRate="fast" disableIntervalMomentum
              contentContainerStyle={{ gap: 16, paddingHorizontal: (width - CW) / 2, paddingTop: 14 }}
              onScroll={(e) => { const i = Math.max(0, Math.min(live.length, Math.round(e.nativeEvent.contentOffset.x / STEP))); if (i !== active) setActive(i); }} scrollEventThrottle={32}>
              {live.map((c, i) => {
                const cv = views[i];
                const up = cv && (c.flipped || c.state === "claiming");
                return (
                  <View key={c.id} style={{ width: CW, opacity: i === active ? 1 : 0.5, transform: [{ scale: i === active ? 1 : 0.9 }] }}>
                    {!cv ? (
                      <View style={{ opacity: 0.5 }} accessibilityLabel="Randomness pending"><CardBack width={CW} /></View>
                    ) : up ? (
                      <View><HoloCard {...cv.face} width={CW} />{burst?.id === c.id && <CoinBurst colors={burst.colors} count={burst.count} />}</View>
                    ) : (
                      <Pressable onPress={() => flip([c])} accessibilityLabel={`Flip card ${i + 1}`}><CardBack rarity={cv.tier.key} tease width={CW} /></Pressable>
                    )}
                  </View>
                );
              })}
              <View style={{ width: CW, height: 368, borderRadius: 16, backgroundColor: colors.text, padding: 18 }}>
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
            </ScrollView>
          </View>
          <View style={{ alignItems: "center", paddingHorizontal: 24, minHeight: 62 }}>
            <Text style={{ fontFamily: font.heavy, fontSize: 24, color: atSummary || !isUp || !v ? colors.text : v.tier.color }}>
              {atSummary ? "Pack done" : !v ? "Drawing…" : !isUp ? `Card ${active + 1} of ${live.length}` : v.caption.title}
            </Text>
            <Text style={[ui.mono, { color: "#C9C2E6", textAlign: "center" }]}>
              {atSummary ? "claim to move the stock into your wallet" : !v ? "randomness pending" : !isUp ? (v.tier.key === "dust" ? "tap to flip" : "it glows: tap to flip") : cur?.state === "claiming" ? "settling on Solana…" : v.caption.sub}
            </Text>
          </View>
          <View accessibilityLabel={`${flipped.length} of ${live.length} cards flipped`} style={[ui.row, { justifyContent: "center", gap: 6, paddingTop: 12, flexWrap: "wrap" }]}>
            {live.slice(0, 16).map((c, i) => <View key={c.id} style={{ width: i === active ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: views[i] && c.flipped ? views[i]!.tier.color : i === active ? colors.text : "#3A3350" }} />)}
          </View>
          <View style={[ui.row, { gap: 10, paddingHorizontal: 20, paddingBottom: 18, marginTop: "auto" }]}>
            {atSummary ? (
              <>
                <Pressable onPress={() => { setAnother(true); }} style={[ui.btn, ui.ghost, { flex: 1 }]}><Text style={ui.ghostText}>Rip another</Text></Pressable>
                <Pressable disabled={busy || !claimable.length} onPress={() => run(g.claimAll).then((ok) => ok && onBinder())} style={[ui.btn, ui.primary, { flex: 1.4, opacity: busy || !claimable.length ? 0.4 : 1 }]}><Text style={ui.btnText}>{busy ? "Working…" : "Add all to binder"}</Text></Pressable>
              </>
            ) : (
              <>
                <Pressable disabled={!v} onPress={() => (isUp ? go(active + 1) : cur && flip([cur]))} style={[ui.btn, { flex: 1, backgroundColor: colors.text, opacity: v ? 1 : 0.4 }]}>
                  <Text style={ui.btnText}>{!isUp ? "Flip" : active === live.length - 1 ? "See the pack total" : "Next card"}</Text>
                </Pressable>
                <Pressable onPress={() => { flip(live); go(live.length); }} style={[ui.btn, ui.ghost]}><Text style={ui.ghostText}>Skip</Text></Pressable>
              </>
            )}
          </View>
        </>
      )}
      <JackpotOverlay card={grail} onClose={() => setGrail(null)} onProof={(id) => { setGrail(null); onProof(id); }} onClaim={() => { setGrail(null); void run(g.claimAll); }} />
    </View>
  );
}
