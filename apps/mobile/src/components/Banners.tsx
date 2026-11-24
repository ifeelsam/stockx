import { Text, View } from "react-native";
import { useGame } from "@scratchers/app-core";
import { colors } from "@scratchers/ui-tokens";

export function Banners() {
  const g = useGame();
  const pending = g.cards.filter((c) => c.state === "pending").length;
  const settling = g.cards.filter((c) => c.state === "claiming").length;
  const items: { k: string; bg: string; fg: string; t: string }[] = [];
  if (g.degraded.length) items.push({ k: "deg", bg: colors.danger + "26", fg: colors.danger, t: `MagicBlock degraded (${g.degraded.join(", ")})` });
  if (g.marketClosed) items.push({ k: "mkt", bg: colors.warn + "26", fg: colors.warn, t: "Price paused: no fresh market price." });
  if (pending) items.push({ k: "vrf", bg: colors.surfaceHi, fg: colors.text, t: `Randomness pending for ${pending} card${pending > 1 ? "s" : ""}…` });
  if (settling) items.push({ k: "set", bg: colors.surfaceHi, fg: colors.text, t: `Settling ${settling} payout${settling > 1 ? "s" : ""} on Solana…` });
  return (
    <View>
      {items.map((b) => (
        <View key={b.k} style={{ backgroundColor: b.bg, paddingVertical: 8, paddingHorizontal: 12 }}>
          <Text style={{ color: b.fg, textAlign: "center", fontSize: 13 }}>{b.t}</Text>
        </View>
      ))}
    </View>
  );
}
