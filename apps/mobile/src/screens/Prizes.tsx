import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { rtp, totalWeight } from "@scratchers/sdk/pure";
import { SERIES, TIER_NAMES } from "@scratchers/app-core";
import { colors, tierByIndex } from "@scratchers/ui-tokens";
import { ui } from "../theme";

export function Prizes() {
  const [sid, setSid] = useState(1);
  const s = SERIES.find((x) => x.id === sid)!;
  const total = totalWeight(s.tiers);
  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.pad, { gap: 12 }]}>
      <Text style={ui.h1}>Prize table</Text>
      <Text style={ui.dim}>Frozen on chain before sales open. tier = u64(seed[0..8]) mod {total.toLocaleString()}.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {SERIES.map((x) => (
          <Pressable key={x.id} onPress={() => setSid(x.id)} style={{ borderColor: x.id === sid ? colors.money : colors.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: x.id === sid ? colors.money : colors.textDim }}>{x.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={ui.card}>
        {s.tiers.map((t, i) => (
          <View key={i} style={[ui.row, { paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderColor: colors.line }]}>
            <Text style={{ flex: 1.2, color: tierByIndex(i).color, fontWeight: "700" }}>{TIER_NAMES[i]}</Text>
            <Text style={[ui.mono, { flex: 0.7 }]}>{t.multiplier}×</Text>
            <Text style={[ui.mono, { flex: 1.2, textAlign: "right" }]}>1 in {(total / t.weight).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
          </View>
        ))}
        <View style={[ui.row, { paddingTop: 8, borderTopWidth: 1, borderColor: colors.line, justifyContent: "space-between" }]}>
          <Text style={ui.h2}>RTP</Text>
          <Text style={[ui.mono, { color: colors.money, fontWeight: "800" }]}>{(rtp(s.tiers) * 100).toFixed(2)}%</Text>
        </View>
      </View>
    </ScrollView>
  );
}
