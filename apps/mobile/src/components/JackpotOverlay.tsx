import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import { TIERS } from "@scratchers/ui-tokens";
import { Symbol } from "./Symbol";
import { CoinBurst } from "./CoinBurst";

function Ring({ delay }: { delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1));
  }, [t, delay]);
  const s = useAnimatedStyle(() => ({ opacity: 0.9 * (1 - t.value), transform: [{ scale: 0.2 + t.value * 5 }] }));
  return <Animated.View style={[styles.ring, s]} />;
}

/** Full-screen Grail moment (1,000×). */
export function JackpotOverlay({ open, usd, onClose }: { open: boolean; usd: number; onClose: () => void }) {
  const t = TIERS.grail;
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = open ? withSpring(1, { damping: 10, stiffness: 160 }) : 0;
  }, [open, pop]);
  const bull = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }, { rotate: `${(1 - pop.value) * -20}deg` }] }));
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.back} onPress={onClose}>
        <Ring delay={0} /><Ring delay={500} /><Ring delay={1000} />
        <CoinBurst colors={[t.color, t.glow, "#fff"]} count={48} spread={220} />
        <Animated.View style={bull}><Symbol name="bull" color={t.color} size={160} /></Animated.View>
        <Text style={[styles.title, { color: t.color }]}>GRAIL · 1,000×</Text>
        <Text style={styles.usd}>${usd.toFixed(2)}</Text>
        <Text style={styles.sub}>in tokenized stock</Text>
        <Text style={styles.tap}>tap to continue</Text>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, backgroundColor: "#0D0B14F0", alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: "#F7D45C" },
  title: { marginTop: 24, fontSize: 38, fontWeight: "900" },
  usd: { marginTop: 8, fontSize: 34, fontWeight: "700", color: "#F2EFFA" },
  sub: { marginTop: 2, color: "#9A93AE", fontSize: 13 },
  tap: { marginTop: 24, color: "#9A93AE" },
});
