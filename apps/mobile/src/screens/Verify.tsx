import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { cardArt, tierFor } from "@scratchers/sdk/pure";
import { SERIES, useGame } from "@scratchers/app-core";
import { colors, tierByMultiplier } from "@scratchers/ui-tokens";
import { Symbol } from "../components/Symbol";
import { ui } from "../theme";

const hex = (s: string) => {
  const c = s.trim().replace(/^0x/, "");
  return /^[0-9a-fA-F]{64}$/.test(c) ? Uint8Array.from(c.match(/../g)!.map((b) => parseInt(b, 16))) : null;
};

export function Verify() {
  const g = useGame();
  const [q, setQ] = useState("");
  const local = /^\d+$/.test(q.trim()) ? g.cards.find((c) => c.id === Number(q.trim())) : undefined;
  const seed = local?.seed ?? hex(q);
  const series = SERIES.find((s) => s.id === (local?.seriesId ?? 11))!;
  const out = useMemo(() => (seed ? { art: cardArt(seed, series.tiers), tier: tierFor(seed, series.tiers) } : null), [seed, series]);
  const t = out && tierByMultiplier(out.art.multiplier);
  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.pad, { gap: 12 }]}>
      <Text style={ui.h1}>Verify a card</Text>
      <Text style={ui.dim}>Paste a card seed (64 hex) or a card # from this session. Same open code recomputes the tier and the panels.</Text>
      <TextInput value={q} onChangeText={setQ} placeholder="card id or seed hex" placeholderTextColor={colors.textDim} autoCapitalize="none"
        style={{ color: colors.text, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 12 }} />
      {q !== "" && !seed && <Text style={{ color: colors.danger }}>Not a valid card id or 32-byte hex seed.</Text>}
      {out && t && (
        <View style={[ui.card, { gap: 10 }]}>
          <View style={[ui.row, { justifyContent: "space-between" }]}>
            <Text style={{ color: out.art.multiplierBps < 10_000 ? colors.textDim : t.color, fontWeight: "800", fontSize: 20 }}>
              {out.art.rarity} · {t.payout}
            </Text>
            <Text style={ui.dim}>tier {out.tier} · {out.art.multiplier.toLocaleString(undefined, { maximumFractionDigits: 2 })}×</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {out.art.panels.map((s, i) => (
              <View key={i} style={{ width: "30%", aspectRatio: 1, borderRadius: 12, backgroundColor: colors.surfaceHi, alignItems: "center", justifyContent: "center", borderWidth: out.art.winningPanels.includes(i) ? 1.5 : 0, borderColor: t.color }}>
                <Symbol name={s} color={out.art.winningPanels.includes(i) ? t.color : colors.textDim} size={34} />
              </View>
            ))}
          </View>
          {local?.art && <Text style={{ color: local.art.tier === out.tier ? colors.money : colors.danger, fontWeight: "700" }}>{local.art.tier === out.tier ? "✓ Matches the recorded result" : "✗ Does not match"}</Text>}
        </View>
      )}
    </ScrollView>
  );
}
