import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { colors, type Feed } from "@scratchers/ui-tokens";
import { ui } from "../theme";
import { CardBack } from "./HoloCard";
import { HoloPack, SEAM_Y } from "./HoloPack";

const W = 286;
const H = 429;
const SY = (SEAM_Y * W) / 220;

/**
 * The sealed pack (design "02 · Rip & reveal"). Dragging along the top seal peels the strip up; reaching the end
 * rips it, and ripping is the buy, so the price sits under it. A tap does the same.
 */
export function PackRip({ feed, count, demo, paused, ripping, price, onRip }: { feed: Feed; count: number; demo: boolean; paused: boolean; ripping: boolean; price: string; onRip: () => void }) {
  const [tear, setTear] = useState(0);
  const far = useRef(0);
  // the responder is built once; it reads the latest props through this ref
  const live = useRef({ off: false, onRip });
  live.current = { off: paused || ripping, onRip };

  const pan = useMemo(() => {
    let fired = false;
    const fire = () => {
      if (live.current.off) return;
      fired = true;
      far.current = 1;
      setTear(1);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      live.current.onRip();
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !live.current.off,
      onMoveShouldSetPanResponder: () => !live.current.off,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { fired = false; },
      onPanResponderMove: (_, g) => {
        if (fired) return;
        const next = Math.max(far.current, Math.min(1, g.dx / (W - 40)));
        if (Math.floor(next * 8) > Math.floor(far.current * 8)) void Haptics.selectionAsync();
        far.current = next;
        setTear(next);
        if (next > 0.9) fire();
      },
      // a short press is a tap (rip); an abandoned drag stays partly torn
      onPanResponderRelease: (_, g) => {
        if (fired) return;
        if (Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8 && far.current < 0.02) return fire();
        far.current *= 0.6;
        setTear(far.current);
      },
    });
  }, []);

  // the strips fly off, the body drops away and the first card rises out of it
  const a = useSharedValue(0);
  const body = useSharedValue(0);
  const rise = useSharedValue(0);
  useEffect(() => {
    if (!ripping) {
      a.value = body.value = rise.value = 0;
      far.current = 0;
      setTear(0);
      return;
    }
    a.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
    rise.value = withDelay(250, withTiming(1, { duration: 900, easing: Easing.out(Easing.back(1.1)) }));
    body.value = withDelay(350, withTiming(1, { duration: 900, easing: Easing.in(Easing.cubic) }));
  }, [ripping, a, body, rise]);

  const stripA = useAnimatedStyle(() => ({
    opacity: 1 - a.value,
    transform: [{ translateX: -240 * a.value }, { translateY: -320 * a.value - (1 - a.value) * tear * 10 }, { rotate: `${-22 * tear * (1 - a.value) - 70 * a.value}deg` }],
  }));
  const stripB = useAnimatedStyle(() => ({ opacity: 1 - a.value, transform: [{ translateX: 260 * a.value }, { translateY: -280 * a.value }, { rotate: `${48 * a.value}deg` }] }));
  const bodyStyle = useAnimatedStyle(() => ({ opacity: 1 - body.value, transform: [{ translateY: 560 * body.value }, { rotate: `${4 * body.value}deg` }] }));
  const card = useAnimatedStyle(() => ({ opacity: rise.value > 0 ? 1 : 0, transform: [{ translateY: 190 * (1 - rise.value) }] }));

  const tx = Math.max(1, tear * W);
  const pack = <HoloPack feed={feed} count={count} demo={demo} paused={paused} offset={tear * 0.6} width={W} />;
  const half = (part: "strip" | "body") => <HoloPack feed={feed} count={count} demo={demo} paused={paused} offset={tear * 0.6} width={W} part={part} />;
  const sealed = !ripping && tear === 0;

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: W, height: H }}>
        {/* the stack of cards peeking out of the top */}
        {/* only under the part already torn, or it shows through the seam ahead of the finger */}
        <View style={{ position: "absolute", left: 22, width: ripping ? W - 44 : Math.max(0, Math.min(W - 44, tear * W - 28)), top: 36, height: 40, borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: "#2B1B5C", opacity: tear > 0.1 ? 1 : 0 }} />
        {ripping && (
          <Animated.View style={[{ position: "absolute", left: 14, top: 20 }, card]}>
            <CardBack width={258} />
          </Animated.View>
        )}
        {sealed ? (
          pack
        ) : (
          <>
            <Animated.View style={[{ position: "absolute", top: SY, width: W, height: H - SY, overflow: "hidden" }, bodyStyle]}>
              <View style={{ marginTop: -SY }}>{half("body")}</View>
            </Animated.View>
            {/* not yet torn */}
            <Animated.View style={[{ position: "absolute", left: tx, top: 0, width: W - tx, height: SY + 6, overflow: "hidden" }, stripB]}>
              <View style={{ marginLeft: -tx }}>{half("strip")}</View>
            </Animated.View>
            {/* peeled: hinged at the tear point */}
            <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: tx, height: SY + 6, overflow: "hidden", transformOrigin: "right bottom" }, stripA]}>
              {half("strip")}
            </Animated.View>
          </>
        )}
        {!ripping && (
          <View {...pan.panHandlers} accessible accessibilityRole="button" accessibilityLabel={`Tear the pack open and buy ${count} card${count > 1 ? "s" : ""} for ${price}`} onAccessibilityTap={() => !live.current.off && onRip()} style={{ position: "absolute", left: -14, right: -14, top: 18, height: 76 }}>
            {/* Android draws a one-sided dashed border as a solid line, so the dashes are views */}
            <View style={{ position: "absolute", left: 14 + tx, right: 14, top: SY - 19, height: 2, flexDirection: "row", justifyContent: "space-between", overflow: "hidden" }}>
              {Array.from({ length: Math.max(1, Math.round(22 * (1 - tear))) }, (_, i) => <View key={i} style={{ width: 7, height: 2, backgroundColor: "rgba(242,239,250,0.85)" }} />)}
            </View>
            <View style={{ position: "absolute", left: 14 + tear * (W - 28), top: SY - 34, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.text, alignItems: "center", justifyContent: "center", elevation: 6 }}>
              <Text style={{ color: colors.ink, fontSize: 21, lineHeight: 23 }}>›</Text>
            </View>
          </View>
        )}
      </View>
      {!ripping && (
        <>
          <Text style={[ui.h1, { marginTop: 32 }]}>{paused ? "Price paused" : tear > 0.02 ? "Keep going…" : "Tear it open"}</Text>
          <Text style={[ui.soft, { marginTop: 4 }]}>{paused ? "Packs resume with the next fresh price." : `Drag along the top seal → ${price}`}</Text>
        </>
      )}
    </View>
  );
}
