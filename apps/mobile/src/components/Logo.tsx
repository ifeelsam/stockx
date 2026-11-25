import { Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { colors, LOGO } from "@scratchers/ui-tokens";
import { font } from "../theme";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size * LOGO.ratio} height={size} viewBox={LOGO.viewBox}>
      <Defs>
        <LinearGradient id="holo" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={LOGO.holo[0]} />
          <Stop offset="0.48" stopColor={LOGO.holo[1]} />
          <Stop offset="1" stopColor={LOGO.holo[2]} />
        </LinearGradient>
      </Defs>
      <Path d={LOGO.top} fill={colors.text} />
      <Path d={LOGO.bottom} fill="url(#holo)" />
    </Svg>
  );
}

export const Wordmark = ({ size = 22 }: { size?: number }) => (
  <Text numberOfLines={1} style={{ fontFamily: font.heavy, fontSize: size, letterSpacing: -size * 0.05, color: colors.text, includeFontPadding: false }}>
    <Text style={{ color: colors.accent }}>rip</Text>stokx
  </Text>
);

/** Mark and wordmark side by side, announced as one name. */
export const Brand = ({ size = 22 }: { size?: number }) => (
  <View accessible accessibilityLabel="ripStokx" style={{ flexDirection: "row", alignItems: "center", gap: size * 0.35 }}>
    <LogoMark size={size * 1.25} />
    <Wordmark size={size} />
  </View>
);
