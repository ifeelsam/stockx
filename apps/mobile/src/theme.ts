import { StyleSheet } from "react-native";
import { colors } from "@scratchers/ui-tokens";

/** Names registered by `useFonts` in App.tsx. */
export const font = {
  heavy: "BricolageGrotesque_800ExtraBold",
  bold: "BricolageGrotesque_700Bold",
  body: "BricolageGrotesque_500Medium",
  mono: "SpaceMono_400Regular",
  monoBold: "SpaceMono_700Bold",
} as const;

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  pad: { padding: 20 },
  h1: { color: colors.text, fontSize: 30, fontFamily: font.heavy, letterSpacing: -1 },
  h2: { color: colors.text, fontSize: 22, fontFamily: font.heavy, letterSpacing: -0.5 },
  dim: { color: colors.textDim, fontFamily: font.body },
  soft: { color: "#C9C2E6", fontFamily: font.body, fontSize: 15, textAlign: "center" },
  text: { color: colors.text, fontFamily: font.body },
  strong: { color: colors.text, fontFamily: font.bold },
  mono: { color: colors.text, fontFamily: font.mono, fontSize: 12 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 14 },
  btn: { minHeight: 56, borderRadius: 14, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: colors.accent },
  ghost: { borderWidth: 1, borderColor: "#3A3350" },
  btnText: { color: colors.ink, fontFamily: font.heavy, fontSize: 17 },
  ghostText: { color: colors.text, fontFamily: font.bold, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center" },
});
