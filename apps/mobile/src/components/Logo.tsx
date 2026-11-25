import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { colors, LOGO, WORDMARK } from "@scratchers/ui-tokens";

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

/** `size` works like a font size. */
export const Wordmark = ({ size = 22 }: { size?: number }) => (
  <Svg width={size * WORDMARK.w} height={size * WORDMARK.h} viewBox={WORDMARK.viewBox}>
    <Defs>
      <LinearGradient id="rip" gradientUnits="userSpaceOnUse" x1={WORDMARK.ripX[0]} y1="0" x2={WORDMARK.ripX[1]} y2="0">
        <Stop offset="0" stopColor={WORDMARK.rainbow[0]} />
        <Stop offset="0.55" stopColor={WORDMARK.rainbow[1]} />
        <Stop offset="1" stopColor={WORDMARK.rainbow[2]} />
      </LinearGradient>
    </Defs>
    <Path d={WORDMARK.rip} fill="url(#rip)" />
    <Path d={WORDMARK.stokx} fill={colors.accent} />
  </Svg>
);

/** Mark and wordmark side by side, announced as one name. */
export const Brand = ({ size = 22 }: { size?: number }) => (
  <View accessible accessibilityLabel="ripStokx" style={{ flexDirection: "row", alignItems: "center", gap: size * 0.35 }}>
    <LogoMark size={size * 1.25} />
    <Wordmark size={size} />
  </View>
);
