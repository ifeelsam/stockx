import { useState } from "react";
import { Dimensions, Pressable, ScrollView, Text, View } from "react-native";
import { LineChart } from "react-native-wagmi-charts";
import { useGame } from "@scratchers/app-core";
import { colors } from "@scratchers/ui-tokens";
import { ui } from "../theme";

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;

export function Portfolio() {
  const g = useGame();
  const [sel, setSel] = useState<string | null>(null);
  const total = g.holdings.reduce((a, h) => a + h.shares * g.prices[h.feed], 0);
  const cost = g.holdings.reduce((a, h) => a + h.costUsd, 0);
  const cur = g.holdings.find((h) => h.ticker === sel) ?? g.holdings[0];
  const data = cur ? g.history[cur.feed].map((p) => ({ timestamp: p.t * 1000, value: p.v })) : [];
  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.pad, { gap: 14 }]}>
      <Text style={ui.h1}>Portfolio</Text>
      <View style={[ui.row, { gap: 12, alignItems: "baseline" }]}>
        <Text style={[ui.mono, { fontSize: 34, fontWeight: "800" }]}>{usd(total)}</Text>
        {g.holdings.length > 0 && <Text style={{ color: total >= cost ? colors.money : colors.danger }}>{total >= cost ? "+" : ""}{usd(total - cost)} since wins</Text>}
      </View>
      {g.holdings.length === 0 ? <Text style={ui.dim}>No shares yet. Win a card and claim it.</Text> : (
        <>
          {g.holdings.map((h) => {
            const v = h.shares * g.prices[h.feed];
            return (
              <Pressable key={h.ticker} onPress={() => setSel(h.ticker)} style={[ui.card, { borderColor: cur?.ticker === h.ticker ? colors.money : colors.line }]}>
                <View style={[ui.row, { justifyContent: "space-between" }]}>
                  <Text style={ui.h2}>{h.ticker}</Text>
                  <Text style={ui.mono}>{usd(v)}</Text>
                </View>
                <View style={[ui.row, { justifyContent: "space-between" }]}>
                  <Text style={ui.dim}>{h.shares.toFixed(4)} @ {usd(g.prices[h.feed])}</Text>
                  <Text style={{ color: v >= h.costUsd ? colors.money : colors.danger }}>{usd(v - h.costUsd)}</Text>
                </View>
                <Pressable onPress={() => g.sell(h.ticker, h.shares)} style={[ui.btn, { marginTop: 10, borderColor: colors.line, borderWidth: 1, paddingVertical: 10 }]}><Text style={[ui.btnText, { color: colors.text, fontSize: 14 }]}>Sell all</Text></Pressable>
              </Pressable>
            );
          })}
          {cur && data.length > 1 && (
            <View style={ui.card}>
              <Text style={[ui.dim, { marginBottom: 6 }]}>{cur.ticker} live price · rollup feed</Text>
              <LineChart.Provider data={data}>
                <LineChart height={150} width={Dimensions.get("window").width - 60}>
                  <LineChart.Path color={colors.money} width={2} />
                  <LineChart.CursorCrosshair color={colors.money} />
                </LineChart>
                <LineChart.PriceText style={{ color: colors.text }} precision={2} />
              </LineChart.Provider>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
