import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { PanResponder, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, ZoomIn } from "react-native-reanimated";
import { CardBack } from "./HoloCard";

export const DECK_W = 258;
const H = (DECK_W * 408) / 286;
const FLY_MS = 260;

/**
 * The pulled pack as a stack: the top card faces up, the rest peek out underneath. Swipe (or tap) the top card
 * to throw it off. `advance` is exposed through `controls` so a button can do the same.
 */
export function Deck({ id, under, onNext, controls, locked, children }: { id: number | string; under: number; onNext: () => void; controls: { current: (() => void) | null }; locked: boolean; children: ReactNode }) {
  const x = useSharedValue(0);
  const live = useRef({ onNext, locked, leaving: false });
  live.current.onNext = onNext;
  live.current.locked = locked;
  // a new top card starts centred
  useEffect(() => {
    live.current.leaving = false;
    x.value = 0;
  }, [id, x]);

  const advance = useMemo(
    () => (dir: number = 1) => {
      if (live.current.leaving || live.current.locked) return;
      live.current.leaving = true;
      x.value = withTiming(dir * 520, { duration: FLY_MS });
      setTimeout(() => live.current.onNext(), FLY_MS);
    },
    [x],
  );
  controls.current = () => advance(1);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !live.current.locked,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => { if (!live.current.leaving) x.value = g.dx; },
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) > 80) advance(g.dx > 0 ? 1 : -1);
          else if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) advance(1);
          else x.value = withTiming(0);
        },
        onPanResponderTerminate: () => { x.value = withTiming(0); },
      }),
    [advance, x],
  );
  const top = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { rotate: `${x.value / 16}deg` }] }));

  return (
    <View style={{ width: DECK_W, height: H + 40, alignSelf: "center" }}>
      {Array.from({ length: Math.min(3, under) }, (_, i) => {
        const k = Math.min(3, under) - 1 - i; // draw the deepest first
        return (
          <View key={k} pointerEvents="none" style={{ position: "absolute", top: 0, transformOrigin: "center top", transform: [{ translateY: (k + 1) * 12 + (H * (k + 1) * 0.045) }, { scale: 1 - (k + 1) * 0.045 }], opacity: 1 - k * 0.2 }}>
            <CardBack width={DECK_W} />
          </View>
        );
      })}
      <Animated.View {...pan.panHandlers} style={top}>
        <Animated.View key={id} entering={ZoomIn.duration(220)}>{children}</Animated.View>
      </Animated.View>
    </View>
  );
}
