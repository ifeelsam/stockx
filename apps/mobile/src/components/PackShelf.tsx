import { useRef, type ComponentRef } from "react";
import { Pressable, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { isPaused, useGame, VISIBLE_SERIES } from "@scratchers/app-core";
import { colors } from "@scratchers/ui-tokens";
import { ui } from "../theme";
import { HoloPack } from "./HoloPack";

const N = VISIBLE_SERIES.length;
const STEP = 236; // 220 pack + 16 gap
// ponytail: three copies are enough because a swipe moves one pack at most (disableIntervalMomentum)
const COPIES = 3;

function Slot({ k, x, onPress, label, children }: { k: number; x: SharedValue<number>; onPress: () => void; label: string; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => {
    const d = (k * STEP - x.value) / STEP;
    const ad = Math.min(Math.abs(d), 1);
    return { opacity: 1 - ad * 0.35, transform: [{ translateY: ad * 10 }, { rotate: `${-Math.max(-1, Math.min(1, d)) * 4}deg` }, { scale: 1 - ad * 0.13 }] };
  });
  return (
    <Animated.View style={[{ transformOrigin: "center bottom" }, style]}>
      <Pressable onPress={onPress} accessibilityLabel={label}>{children}</Pressable>
    </Animated.View>
  );
}

/** The endless pack shelf (design "01 · Packs"). After each swipe the position returns to the middle copy, which looks identical. */
export function PackShelf({ sid, onPick }: { sid: number; onPick: (id: number) => void }) {
  const g = useGame();
  const { width } = useWindowDimensions();
  const picked = Math.max(0, VISIBLE_SERIES.findIndex((s) => s.id === sid));
  const start = (N + picked) * STEP;
  const x = useSharedValue(start);
  const list = useRef<ComponentRef<typeof Animated.ScrollView>>(null);
  const placed = useRef(false);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const k = Math.round(e.nativeEvent.contentOffset.x / STEP);
    const home = N + (((k % N) + N) % N);
    onPick(VISIBLE_SERIES[home - N].id);
    if (home !== k) list.current?.scrollTo({ x: home * STEP, animated: false });
  };

  return (
    <View>
      <Animated.ScrollView
        ref={list}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={STEP}
        decelerationRate="fast"
        disableIntervalMomentum
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={settle}
        contentOffset={{ x: start, y: 0 }}
        onContentSizeChange={(w) => {
          if (placed.current || w <= start) return;
          placed.current = true;
          // Android ignores a scroll issued in the same frame the content is measured
          requestAnimationFrame(() => list.current?.scrollTo({ x: start, animated: false }));
        }}
        contentContainerStyle={{ gap: 16, paddingHorizontal: (width - 220) / 2, paddingTop: 26, paddingBottom: 26 }}
      >
        {Array.from({ length: N * COPIES }, (_, k) => {
          const s = VISIBLE_SERIES[k % N];
          return (
            <Slot key={k} k={k} x={x} label={`Choose the ${s.name}`} onPress={() => { onPick(s.id); list.current?.scrollTo({ x: k * STEP, animated: true }); }}>
              <HoloPack feed={s.feed} demo={s.demo} paused={isPaused(g, s.feed)} />
            </Slot>
          );
        })}
      </Animated.ScrollView>
      <View style={[ui.row, { justifyContent: "center", gap: 6 }]}>
        {VISIBLE_SERIES.map((s, i) => <View key={s.id} style={{ width: i === picked ? 22 : 6, height: 6, borderRadius: 3, backgroundColor: i === picked ? colors.accent : "#3A3350" }} />)}
      </View>
    </View>
  );
}
