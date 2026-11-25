import { useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { LineChart } from "react-native-wagmi-charts";
import { SERIES, seriesById, useGame, VISIBLE_SERIES, type UiCard } from "@scratchers/app-core";
import { change, colors, describeCard, money, oddsText, TIERS, TIER_KEYS, type Feed, type TierKey } from "@scratchers/ui-tokens";
import { Gem, HoloCard } from "../components/HoloCard";
import { font, ui } from "../theme";

type Shown = UiCard & { art: NonNullable<UiCard["art"]> };

/** Binder: the cards you pulled, by stock and rarity, plus the shares they paid into your wallet. */
export function Portfolio() {
  const g = useGame();
  const { width } = useWindowDimensions();
  const [set, setSet] = useState<Feed>("TSLA");
  const [sel, setSel] = useState<TierKey | null>(null);
  const feeds = [...new Set<Feed>([...VISIBLE_SERIES.map((s) => s.feed), ...g.holdings.map((h) => h.feed)])];
  const total = g.holdings.reduce((a, h) => a + h.shares * g.prices[h.feed], 0);
  const cost = g.holdings.reduce((a, h) => a + h.costUsd, 0);

  // ponytail: history = the card slots still on the Player account (32, reused by later buys).
  // A full binder needs an indexer over CardRevealed events.
  const mine = g.cards.filter((c): c is Shown => !!c.art && (c.flipped || c.state === "settled"));
  const slotsFor = (feed: Feed) => {
    const m = new Map<TierKey, Shown[]>();
    for (const c of mine) {
      const s = seriesById(c.seriesId);
      if (s.feed !== feed) continue;
      const k = describeCard(c, s, g.prices[feed]).tier.key;
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return m;
  };
  const slots = slotsFor(set);
  const pick = sel && slots.has(sel) ? sel : undefined;
  const card = pick ? slots.get(pick)!.at(-1)! : undefined;
  const view = card && describeCard(card, seriesById(card.seriesId), g.prices[set]);
  const holding = g.holdings.find((h) => h.feed === set);
  const data = g.history[set].map((p) => ({ timestamp: p.t * 1000, value: p.v }));
  const col = Math.floor((width - 40 - 24) / 3);
  const all = change(total - cost);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.pad, { gap: 14 }]}>
      <Text style={[ui.h1, { fontSize: 40 }]}>Binder</Text>
      <View style={[ui.row, { gap: 10, alignItems: "baseline", marginTop: -8 }]}>
        <Text style={[ui.h1, { fontSize: 30 }]}>{money(total)}</Text>
        {g.holdings.length > 0 && <Text style={{ fontFamily: font.bold, color: all.down ? colors.danger : colors.accent }}>{all.text} since pulled</Text>}
      </View>
      <View style={[ui.row, { gap: 8 }]}>
        {feeds.map((f) => (
          <Pressable key={f} onPress={() => { setSet(f); setSel(null); }} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, justifyContent: "center", borderColor: f === set ? colors.text : "#3A3350", backgroundColor: f === set ? colors.text : "transparent" }}>
            <Text style={{ fontFamily: font.heavy, color: f === set ? colors.ink : colors.text }}>{f} · {slotsFor(f).size}/8</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 6 }}>
        <View style={[ui.row, { justifyContent: "space-between" }]}>
          <Text style={ui.strong}>{set} set</Text>
          <Text style={[ui.mono, { color: "#C9C2E6" }]}>{slots.size} of 8 rarities</Text>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.line }}><View style={{ height: 6, borderRadius: 3, width: `${(slots.size / 8) * 100}%`, backgroundColor: colors.accent }} /></View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {TIER_KEYS.map((k, i) => {
          const owned = slots.get(k);
          const v = owned && describeCard(owned.at(-1)!, seriesById(owned.at(-1)!.seriesId), g.prices[set]);
          const h = Math.round((col * 408) / 286);
          return (
            <View key={k} style={{ width: col, gap: 5 }}>
              {v ? (
                <>
                  <Pressable onPress={() => setSel(k === sel ? null : k)} accessibilityLabel={`Show your ${TIERS[k].label} card`}><HoloCard {...v.face} width={col} /></Pressable>
                  <Text style={[ui.strong, { fontSize: 12 }]}>{money(v.value)}{owned.length > 1 ? `  ×${owned.length}` : ""}</Text>
                </>
              ) : (
                <>
                  <View style={{ width: col, height: h, borderRadius: 7, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#3A3350", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Gem fill={TIERS[k].color} size={16} />
                    <Text style={[ui.strong, { fontSize: 13, color: "#C9C2E6" }]}>{TIERS[k].label}</Text>
                  </View>
                  <Text style={[ui.mono, { fontSize: 10, color: colors.textDim }]}>{oddsText(SERIES[0].tiers[i].weight, 100_000)}</Text>
                </>
              )}
            </View>
          );
        })}
      </View>
      {view && (
        <View style={{ alignItems: "center", gap: 8 }}>
          <HoloCard {...view.face} width={286} />
        </View>
      )}
      {data.length > 1 && data[data.length - 1].value > 0 && (
        <View style={ui.card}>
          <Text style={[ui.dim, { marginBottom: 6 }]}>{set} live price · rollup feed</Text>
          <LineChart.Provider data={data}>
            <LineChart height={90} width={width - 70}>
              <LineChart.Path color={colors.accent} width={2} />
            </LineChart>
          </LineChart.Provider>
        </View>
      )}
      {holding ? (
        <>
          <Text style={[ui.mono, { color: "#C9C2E6" }]}>In your wallet: {holding.shares.toFixed(6)} {holding.ticker} ≈ {money(holding.shares * g.prices[set])}</Text>
          <Pressable onPress={() => g.sell(holding.ticker, holding.shares)} style={[ui.btn, ui.ghost]}><Text style={ui.ghostText}>Sell all {holding.ticker} for USDC</Text></Pressable>
        </>
      ) : (
        <Text style={[ui.mono, { color: colors.textDim }]}>No {set} shares in your wallet yet. Claim a pack to receive them.</Text>
      )}
    </ScrollView>
  );
}
