import { useEffect, useState } from "react";
import { Text, type TextStyle } from "react-native";
import { Easing } from "react-native-reanimated";
import { timing } from "@scratchers/ui-tokens";

const ease = Easing.out(Easing.cubic);

/** JS-driven count-up (text can't run on the UI thread); eased with the same curve family as web. */
export function CountUp({ to, prefix = "$", decimals = 2, style }: { to: number; prefix?: string; decimals?: number; style?: TextStyle }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / timing.countUp);
      setV(to * ease(p));
      if (p >= 1) clearInterval(iv);
    }, 16);
    return () => clearInterval(iv);
  }, [to]);
  return <Text style={style}>{prefix}{v.toFixed(decimals)}</Text>;
}
