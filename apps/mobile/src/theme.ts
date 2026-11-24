import { StyleSheet } from "react-native";
import { colors } from "@scratchers/ui-tokens";

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  pad: { padding: 16 },
  h1: { color: colors.text, fontSize: 28, fontWeight: "900" },
  h2: { color: colors.text, fontSize: 18, fontWeight: "700" },
  dim: { color: colors.textDim },
  text: { color: colors.text },
  mono: { color: colors.text, fontVariant: ["tabular-nums"] },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 14 },
  btn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: "center" },
  btnText: { color: colors.ink, fontWeight: "800", fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center" },
});
