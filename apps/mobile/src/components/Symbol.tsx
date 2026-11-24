import Svg, { Path } from "react-native-svg";
import { SYMBOL_PATHS } from "@scratchers/ui-tokens";

export function Symbol({ name, color = "#8B93A7", size = 36 }: { name: string; color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d={SYMBOL_PATHS[name] ?? SYMBOL_PATHS.coin} />
    </Svg>
  );
}
