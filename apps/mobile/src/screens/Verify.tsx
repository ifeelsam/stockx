import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { cardArt, totalWeight } from "@scratchers/sdk/pure";
import { SERIES, seriesById, useGame } from "@scratchers/app-core";
import { colors, tierByMultiplier, TIERS, TIER_KEYS } from "@scratchers/ui-tokens";
import { Gem } from "../components/HoloCard";
import { Symbol } from "../components/Symbol";
import { font, ui } from "../theme";

const fromHex = (s: string) => {
  const c = s.trim().replace(/^0x/, "");
  return /^[0-9a-fA-F]{64}$/.test(c) ? Uint8Array.from(c.match(/../g)!.map((b) => parseInt(b, 16))) : undefined;
};
const toHex = (u: Uint8Array) => [...u].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Proof: redo the roll from the VRF seed with the same open code the app uses. */
export function Verify({ initial = "" }: { initial?: string }) {
  const g = useGame();
  const [q, setQ] = useState(initial);
  const [sid, setSid] = useState(11);
  const num = q.replace(/[№\s]/g, "");
  const local = /^\d+$/.test(num) ? g.cards.find((c) => c.id === Number(num)) : undefined;
  const seed = local?.seed ?? fromHex(q);
  const series = seriesById(local?.seriesId ?? sid);
  const art = seed && cardArt(seed, series.tiers);
  const total = totalWeight(series.tiers);
  // Hermes has no guaranteed DataView.getBigUint64 on every build: read the 8 bytes by hand
  const first8 = seed && seed.slice(0, 8).reduceRight((a, b) => a * 256n + BigInt(b), 0n);
  const roll = first8 !== undefined ? Number(first8 % BigInt(total)) : undefined;
  const tier = art && tierByMultiplier(art.multiplier);
  const mismatch = !!(local?.art && art && local.art.tier !== art.tier);
  let from = 0;
  const line = (a: string, b: string, bold = false) => (
    <View style={[ui.row, { justifyContent: "space-between", gap: 12 }]}>
      <Text style={[ui.mono, { color: colors.ink }, bold && { fontFamily: font.monoBold }]}>{a}</Text>
      <Text numberOfLines={1} ellipsizeMode="middle" style={[ui.mono, { color: colors.ink, flexShrink: 1 }, bold && { fontFamily: font.monoBold }]}>{b}</Text>
    </View>
  );
  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.pad, { gap: 12 }]} keyboardShouldPersistTaps="handled">
      <Text style={[ui.h1, { fontSize: 34 }]}>Flip any card</Text>
      <Text style={[ui.strong, { color: "#C9C2E6" }]}>Card number or VRF seed</Text>
      <TextInput value={q} onChangeText={setQ} placeholder="000012" placeholderTextColor={colors.textDim} autoCapitalize="none" accessibilityLabel="Card number or VRF seed"
        style={{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: "#3A3350", backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14, fontFamily: font.mono }} />
      {!local && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {SERIES.map((s) => (
            <Pressable key={s.id} onPress={() => setSid(s.id)} style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, justifyContent: "center", borderColor: s.id === sid ? colors.accent : "#3A3350" }}>
              <Text style={[ui.text, { fontSize: 13 }]}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {q !== "" && !seed && <Text style={{ color: colors.danger }}>{local ? "That card is still waiting for randomness." : "No revealed card of yours has that number, and it is not a 32-byte hex seed."}</Text>}
      {art && tier && seed && roll !== undefined && (
        <View style={{ borderRadius: 18, padding: 9, backgroundColor: tier.color }}>
          <View style={{ borderRadius: 12, backgroundColor: colors.text, padding: 14, gap: 10 }}>
            <View style={[ui.row, { justifyContent: "space-between" }]}>
              <Text style={{ fontFamily: font.heavy, fontSize: 22, color: colors.ink }}>Card back</Text>
              <Text style={{ fontFamily: font.bold, color: colors.ink }}>{series.feed} · {tier.label}</Text>
            </View>
            <View>
              {line("vrf seed", toHex(seed))}
              {line("first 8 bytes", first8!.toString())}
              {line(`mod ${total.toLocaleString("en-US")}`, `= ${roll.toLocaleString("en-US")}`, true)}
            </View>
            {TIER_KEYS.map((k, i) => {
              const lo = from;
              from += series.tiers[i].weight;
              const hit = i === art.tier;
              return (
                <View key={k} style={[ui.row, { gap: 8, borderRadius: 6, paddingHorizontal: 6, minHeight: 24, backgroundColor: hit ? colors.ink : "transparent" }]}>
                  <Gem fill={TIERS[k].color} size={10} />
                  <Text style={{ fontFamily: hit ? font.heavy : font.body, color: hit ? colors.text : colors.ink, width: 84 }}>{TIERS[k].label}</Text>
                  <Text style={[ui.mono, { marginLeft: "auto", fontSize: 10, color: hit ? colors.text : colors.ink }]}>{lo.toLocaleString("en-US")}–{(from - 1).toLocaleString("en-US")}</Text>
                </View>
              );
            })}
            <View style={[ui.row, { justifyContent: "space-between", borderTopWidth: 1, borderColor: "#D9D4E6", paddingTop: 10 }]} accessibilityLabel="Panel symbols derived from the seed">
              {art.panels.map((s, i) => <Symbol key={i} name={s} size={26} color={art.winningPanels.includes(i) ? colors.ink : "#8B8798"} />)}
            </View>
            <Text style={{ fontFamily: font.bold, color: mismatch ? "#B3261E" : colors.ink }}>
              {mismatch ? "Does not match the recorded result." : local ? `✓ ${roll.toLocaleString("en-US")} lands in ${tier.label}. Matches ${g.backend === "chain" ? "the card on chain" : "the recorded result"}.` : `${roll.toLocaleString("en-US")} lands in ${tier.label}.`}
            </Text>
          </View>
        </View>
      )}
      <Text style={[ui.soft, { textAlign: "left" }]}>The odds are frozen on chain before any pack is sold. Anyone can redo this sum.</Text>
    </ScrollView>
  );
}
