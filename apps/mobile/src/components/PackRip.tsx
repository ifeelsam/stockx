import { useMemo, useRef, useState } from "react";
import { PanResponder, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, type Feed } from "@scratchers/ui-tokens";
import { ui } from "../theme";
import { HoloPack } from "./HoloPack";

const W = 270;

/** The sealed pack. Tearing the seal (drag across, or tap it) is the buy, so the price sits under it. */
export function PackRip({ feed, count, demo, paused, busy, price, onRip }: { feed: Feed; count: number; demo: boolean; paused: boolean; busy: boolean; price: string; onRip: () => void }) {
  const [tear, setTear] = useState(0);
  const far = useRef(0);
  // the responder is built once per render; read the latest props through a ref
  const live = useRef({ off: false, onRip });
  live.current = { off: paused || busy, onRip };

  const pan = useMemo(() => {
    const done = (rip: boolean) => {
      far.current = 0;
      setTear(0);
      if (rip && !live.current.off) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        live.current.onRip();
      }
    };
    let fired = false;
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
        if (next > 0.85) {
          fired = true;
          done(true);
        }
      },
      // a short press is a tap (rip); an abandoned drag springs back
      onPanResponderRelease: (_, g) => { if (!fired) done(Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8); },
      onPanResponderTerminate: () => done(false),
    });
  }, []);

  const shown = busy ? 1 : tear;
  return (
    <View style={{ alignItems: "center" }}>
      <View>
        <HoloPack feed={feed} count={count} demo={demo} paused={paused} offset={shown * 0.8} width={W} />
        <View {...pan.panHandlers} accessible accessibilityRole="button" accessibilityLabel={`Tear the pack open and buy ${count} card${count > 1 ? "s" : ""} for ${price}`} onAccessibilityTap={() => !live.current.off && onRip()} style={{ position: "absolute", left: -10, right: -10, top: 0, height: 72 }}>
          <View style={{ position: "absolute", left: 20, right: 20, top: 40, borderTopWidth: 2, borderStyle: "dashed", borderColor: "rgba(242,239,250,0.85)" }} />
          <View style={{ position: "absolute", left: 20, top: 38, height: 6, width: shown * (W - 20), borderRadius: 3, backgroundColor: colors.text }} />
          <View style={{ position: "absolute", left: 3 + shown * (W - 20), top: 24, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.text, alignItems: "center", justifyContent: "center", elevation: 6 }}>
            <Text style={{ color: colors.ink, fontSize: 22, lineHeight: 24 }}>›</Text>
          </View>
        </View>
      </View>
      <Text style={[ui.h1, { marginTop: 36 }]}>{busy ? "Ripping…" : paused ? "Price paused" : "Tear it open"}</Text>
      <Text style={[ui.soft, { marginTop: 4 }]}>{busy ? "Sending to the rollup" : paused ? "Packs resume with the next fresh price." : `Drag across the top seal → ${price}`}</Text>
    </View>
  );
}
