import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { timing } from "@scratchers/ui-tokens";

function Dot({ angle, dist, color, delay }: { angle: number; dist: number; color: string; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: timing.confetti, easing: Easing.out(Easing.cubic) }));
  }, [t, delay]);
  const s = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ translateX: Math.cos(angle) * dist * t.value }, { translateY: Math.sin(angle) * dist * t.value + 60 * t.value * t.value }, { scale: 1 - t.value * 0.4 }],
  }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, s]} />;
}

/** Radial particle burst; intensity scales with the tier's fx bucket. */
export function CoinBurst({ colors, count = 24, spread = 140 }: { colors: string[]; count?: number; spread?: number }) {
  const dots = useMemo(
    () => Array.from({ length: count }, (_, i) => ({ angle: (i / count) * Math.PI * 2 + Math.random() * 0.3, dist: spread * (0.5 + Math.random() * 0.7), color: colors[i % colors.length], delay: Math.random() * 120 })),
    [count, spread, colors],
  );
  return (
    <View pointerEvents="none" style={styles.wrap}>
      {dots.map((d, i) => <Dot key={i} {...d} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: "50%", top: "50%", width: 0, height: 0 },
  dot: { position: "absolute", width: 8, height: 8, borderRadius: 4 },
});
