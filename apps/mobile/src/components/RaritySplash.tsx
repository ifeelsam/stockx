import { useEffect, useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Canvas, Group, Path, RadialGradient, Rect, SweepGradient, vec } from "@shopify/react-native-skia";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming, ZoomIn, FadeInDown } from "react-native-reanimated";
import Svg, { Path as SvgPath } from "react-native-svg";
import { SPLASH, SPLASH_MS, STOCK_LOOK, TIERS, type Feed, type TierKey } from "@scratchers/ui-tokens";
import { font } from "../theme";

/** 0 → 1 over `ms`, started after `delay`; repeats when `loop`. */
function useProgress(ms: number, delay = 0, loop = false, linear = false) {
  const t = useSharedValue(0);
  useEffect(() => {
    const one = withTiming(1, { duration: ms, easing: linear ? Easing.linear : Easing.out(Easing.cubic) });
    t.value = withDelay(delay, loop ? withRepeat(one, -1) : one);
  }, [t, ms, delay, loop, linear]);
  return t;
}

function Ring({ x, y, color, width, delay }: { x: number; y: number; color: string; width: number; delay: number }) {
  const t = useProgress(1600, delay, true);
  const s = useAnimatedStyle(() => ({ opacity: 0.9 * (1 - t.value), transform: [{ scale: 0.1 + t.value * 3.1 }] }));
  return <Animated.View style={[{ position: "absolute", left: x - 110, top: y - 110, width: 220, height: 220, borderRadius: 110, borderWidth: width, borderColor: color }, s]} />;
}

function Streak({ x, y, angle, color, ms, delay }: { x: number; y: number; angle: number; color: string; ms: number; delay: number }) {
  const t = useProgress(ms, delay, true, true);
  const s = useAnimatedStyle(() => ({
    opacity: t.value < 0.2 ? t.value * 5 : 1 - t.value,
    transform: [{ rotate: `${angle}deg` }, { translateX: 40 + t.value * 520 }, { scaleX: 0.2 + t.value * 1.4 }],
  }));
  return <Animated.View style={[{ position: "absolute", left: x - 35, top: y - 1, width: 70, height: 2, backgroundColor: color }, s]} />;
}

function Ember({ x, bottom, size, color, ms, delay }: { x: number; bottom: number; size: number; color: string; ms: number; delay: number }) {
  const t = useProgress(ms, delay, true, true);
  const s = useAnimatedStyle(() => ({ opacity: t.value < 0.15 ? t.value / 0.15 : 1 - t.value, transform: [{ translateY: -bottom * t.value }, { scale: 1 - t.value * 0.7 }] }));
  return <Animated.View style={[{ position: "absolute", left: x, bottom: -20, width: size, height: size, borderRadius: size / 2, backgroundColor: color }, s]} />;
}

function Shard({ x, y, dx, dy, turn, color }: { x: number; y: number; dx: number; dy: number; turn: number; color: string }) {
  const t = useProgress(1100, 300);
  const s = useAnimatedStyle(() => ({ opacity: t.value === 0 ? 0 : 1 - t.value, transform: [{ translateX: dx * t.value }, { translateY: dy * t.value }, { rotate: `${45 + turn * t.value}deg` }, { scale: 1 - t.value * 0.6 }] }));
  return <Animated.View style={[{ position: "absolute", left: x - 7, top: y - 7, width: 14, height: 14, backgroundColor: color }, s]} />;
}

function Twinkle({ x, y, size, color, ms, delay }: { x: number; y: number; size: number; color: string; ms: number; delay: number }) {
  const t = useProgress(ms, delay, true, true);
  const s = useAnimatedStyle(() => {
    const v = 1 - Math.abs(t.value * 2 - 1);
    return { opacity: v, transform: [{ scale: 0.2 + v * 0.8 }, { rotate: `${v * 45}deg` }] };
  });
  return (
    <Animated.View style={[{ position: "absolute", left: x, top: y }, s]}>
      <Svg width={size} height={size} viewBox="0 0 20 20"><SvgPath d="M10 0 C11 7 13 9 20 10 C13 11 11 13 10 20 C9 13 7 11 0 10 C7 9 9 7 10 0 Z" fill={color} /></Svg>
    </Animated.View>
  );
}

/** The splash that plays when a card of Uncommon or better reaches the top of the deck. Tap (or wait) to see the card. */
export function RaritySplash({ rarity, feed, mult, usd, odds, onClose }: { rarity: TierKey; feed: Feed; mult: string; usd: string; odds: string; onClose: () => void }) {
  const R = SPLASH[rarity]!;
  const c = TIERS[rarity].color;
  const { width: w, height: h } = useWindowDimensions();
  const cx = w / 2;
  const cy = h * 0.37;
  useEffect(() => {
    const t = setTimeout(onClose, SPLASH_MS);
    return () => clearTimeout(t);
  }, [onClose]);
  const spin = useProgress(14000, 0, true, true);
  const rays = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const gem = useSharedValue(0);
  useEffect(() => {
    gem.value = withDelay(150, withSpring(1, { damping: 9, stiffness: 140 }));
  }, [gem]);
  const turn = useProgress(3200, 900, true, true);
  const gemStyle = useAnimatedStyle(() => ({ transform: [{ perspective: 800 }, { scale: gem.value }, { rotateY: `${turn.value * 360}deg` }] }));
  const black = useProgress(1100, 0, false, true);
  const blackStyle = useAnimatedStyle(() => ({ opacity: black.value < 0.55 ? 1 : (1 - black.value) / 0.45 }));
  const rayPath = useMemo(() => {
    if (!R.rays) return "";
    const n = R.rays.count;
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const b = a + (Math.PI / n) * 0.75;
      return `M 400 400 L ${400 + Math.cos(a) * 400} ${400 + Math.sin(a) * 400} L ${400 + Math.cos(b) * 400} ${400 + Math.sin(b) * 400} Z`;
    }).join(" ");
  }, [R.rays]);
  const hex = (o: number) => Math.round(o * 255).toString(16).padStart(2, "0");

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: R.bg, overflow: "hidden" }} onPress={onClose} accessibilityLabel={`${TIERS[rarity].label} pull. Tap to see your card`}>
        <Canvas style={StyleSheet.absoluteFill}>
          {R.prism && (
            <Group>
              <Rect x={0} y={0} width={w} height={h} opacity={0.55}>
                <SweepGradient c={vec(cx, cy)} colors={["#FF5C8A", "#FFB86B", "#FEFF9C", "#7AFCFF", "#B28DFF", "#FF5C8A"]} />
              </Rect>
              {/* dark edge so the prism reads as a burst, not a flat wash */}
              <Rect x={0} y={0} width={w} height={h}>
                <RadialGradient c={vec(cx, cy)} r={h * 0.62} colors={["rgba(13,11,20,0)", "rgba(13,11,20,0.35)", "rgba(13,11,20,0.9)"]} positions={[0, 0.45, 0.9]} />
              </Rect>
            </Group>
          )}
          <Group>
            <Rect x={0} y={0} width={w} height={h}>
              <RadialGradient c={vec(cx, cy)} r={w * 0.9} colors={[c + hex(R.glow), c + "00"]} />
            </Rect>
          </Group>
        </Canvas>
        {R.rays && (
          <Animated.View pointerEvents="none" style={[{ position: "absolute", left: cx - 400, top: cy - 400, width: 800, height: 800 }, rays]}>
            <Canvas style={{ width: 800, height: 800 }}>
              <Path path={rayPath} opacity={R.rays.opacity}>
                <RadialGradient c={vec(400, 400)} r={390} colors={[c, c + "00"]} />
              </Path>
            </Canvas>
          </Animated.View>
        )}
        {Array.from({ length: R.rings }, (_, i) => <Ring key={i} x={cx} y={cy} color={c} width={4 - i * 0.8} delay={i * 400} />)}
        {R.warp && Array.from({ length: 28 }, (_, i) => <Streak key={i} x={cx} y={cy} angle={(i * 360) / 28 + (i % 3) * 4} color={R.warp![i % R.warp!.length]} ms={900 + (i % 5) * 180} delay={(i * 110) % 900} />)}
        {R.embers && Array.from({ length: 18 }, (_, i) => <Ember key={i} x={(i * 53 + 11) % w} bottom={h * 0.9} size={4 + (i % 4) * 2} color={R.embers![i % 3]} ms={2600 + (i % 5) * 500} delay={(i * 170) % 1800} />)}
        {R.sparkle && Array.from({ length: 16 }, (_, i) => <Twinkle key={i} x={(i * 89 + 23) % (w - 30)} y={(i * 137 + 40) % (h - 60)} size={10 + (i % 4) * 6} color={["#FFD84D", "#FFFFFF", "#FFF3B0"][i % 3]} ms={1400 + (i % 4) * 400} delay={(i * 130) % 900} />)}
        {R.shards &&
          Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2 + 0.3;
            const d = 150 + (i % 3) * 40;
            const cols = R.prism ? R.warp! : [c, "#FFFFFF"];
            return <Shard key={i} x={cx} y={cy} dx={Math.cos(a) * d} dy={Math.sin(a) * d} turn={(i * 77) % 360} color={cols[i % cols.length]} />;
          })}

        <Animated.View style={[{ position: "absolute", left: cx - 75, top: cy - 75 }, gemStyle]}>
          <Svg width={150} height={150} viewBox="0 0 150 150">
            <SvgPath d="M75 4 L146 75 L75 146 L4 75 Z" fill={c} />
            <SvgPath d="M75 4 L146 75 L75 75 Z" fill="rgba(255,255,255,0.35)" />
            <SvgPath d="M4 75 L75 146 L75 75 Z" fill="rgba(0,0,0,0.25)" />
            <SvgPath d="M75 34 L116 75 L75 116 L34 75 Z" fill="none" stroke="rgba(13,11,20,0.55)" strokeWidth={3} />
          </Svg>
        </Animated.View>

        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: cy + 105, alignItems: "center", paddingHorizontal: 12 }}>
          <Animated.Text entering={ZoomIn.delay(450).springify().damping(12)} numberOfLines={1} adjustsFontSizeToFit
            style={{ fontFamily: font.heavy, fontSize: Math.min(R.size, w * 0.24), color: R.word, letterSpacing: -3, textShadowColor: c, textShadowRadius: 30, paddingHorizontal: 20 }}>
            {rarity === "grail" ? "GRAIL" : TIERS[rarity].label}
          </Animated.Text>
          <Animated.View entering={FadeInDown.delay(850)} style={{ alignItems: "center", gap: 5, marginTop: 8 }}>
            <Text style={{ fontFamily: font.heavy, fontSize: 22, color: "#F2EFFA" }}>{STOCK_LOOK[feed].symbol} · {mult}</Text>
            <Text style={{ fontFamily: font.mono, fontSize: 13, color: "#E4DFF0" }}>{usd} in {STOCK_LOOK[feed].company} shares</Text>
            <Text style={{ fontFamily: font.mono, fontSize: 11, color: c }}>{odds}</Text>
          </Animated.View>
        </View>
        <Text style={{ position: "absolute", left: 0, right: 0, bottom: 48, textAlign: "center", fontFamily: font.bold, fontSize: 15, color: "#F2EFFA" }}>tap to see your card</Text>
        {R.blackout && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }, blackStyle]} />}
      </Pressable>
    </Modal>
  );
}
