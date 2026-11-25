import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { multiplierOf, rtp, totalWeight } from "@scratchers/sdk/pure";
import { SERIES, TIER_NAMES, VISIBLE_SERIES } from "@scratchers/app-core";
import { colors, tierByIndex } from "@scratchers/ui-tokens";
import { ui } from "../theme";

export function Prizes() {
  const [sid, setSid] = useState(11);
  const s = SERIES.find((x) => x.id === sid)!;
  const total = totalWeight(s.tiers);
  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.pad, { gap: 12 }]}>
      <Text style={ui.h1}>Rarity table</Text>
      <Text style={ui.dim}>Frozen on chain before packs open. rarity = u64(seed[0..8]) mod {total.toLocaleString()}.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {VISIBLE_SERIES.map((x) => (
          <Pressable key={x.id} onPress={() => setSid(x.id)} style={{ borderColor: x.id === sid ? colors.accent : colors.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: x.id === sid ? colors.accent : colors.textDim }}>{x.name}{x.demo ? " · DEMO" : ""}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {s.demo && (
        <View style={[ui.card, { borderColor: colors.gold + "66", backgroundColor: colors.gold + "14" }]}>
          <Text style={{ color: colors.gold, fontWeight: "800" }}>DEMO ODDS</Text>
          <Text style={[ui.dim, { fontSize: 12 }]}>Grail about 1 in 20. Never shown as the public table.</Text>
        </View>
      )}
      <View style={ui.card}>
        {s.tiers.map((t, i) => {
          const dust = t.multiplierBps < 10_000;
          return (
            <View key={i} style={[ui.row, { paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderColor: colors.line }]}>
              <Text style={{ flex: 1.2, color: dust ? colors.textDim : tierByIndex(i).color, fontWeight: "700" }}>{TIER_NAMES[i]}</Text>
              <Text style={[ui.mono, { flex: 0.8 }]}>{multiplierOf(t).toLocaleString(undefined, { maximumFractionDigits: 2 })}×{dust ? " · 20¢" : ""}</Text>
              <Text style={[ui.mono, { flex: 1.2, textAlign: "right" }]}>1 in {(total / t.weight).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
            </View>
          );
        })}
        <View style={[ui.row, { paddingTop: 8, borderTopWidth: 1, borderColor: colors.line, justifyContent: "space-between" }]}>
          <Text style={ui.h2}>RTP</Text>
          <Text style={[ui.mono, { color: colors.money, fontWeight: "800" }]}>{(rtp(s.tiers) * 100).toFixed(3)}%</Text>
        </View>
      </View>
      <Text style={[ui.dim, { fontSize: 12 }]}>Every rarity holds stock. Dust is 20¢ back, not a win; celebration starts at Uncommon (2×).</Text>
    </ScrollView>
  );
}
