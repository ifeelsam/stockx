import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors, tierByMultiplier, timing } from "@scratchers/ui-tokens";
import type { CardArt } from "@scratchers/sdk/pure";
import { Symbol } from "./Symbol";
import { revealFx } from "../lib/fx";

const W = 300;
const H = 420;

/**
 * Holo pack card: foil front, hoisted rarity on the back. One tap flips it.
 * Dust is deliberately quiet: plain stock, no holo, no glow, no celebration.
 */
export function HoloCard({
  art,
  flipped,
  onDone,
  disabled,
  cardId,
  ticker,
}: {
  art: CardArt;
  flipped: boolean;
  onDone: () => void;
  disabled?: boolean;
  cardId: number;
  ticker: string;
}) {
  const [open, setOpen] = useState(flipped);
  const rot = useSharedValue(flipped ? 180 : 0);
  useEffect(() => {
    setOpen(flipped);
    rot.value = withTiming(flipped ? 180 : 0, { duration: timing.flip, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [flipped, rot]);

  const tier = tierByMultiplier(art.multiplier);
  const dust = art.multiplierBps < 10_000;
  const holo = art.multiplierBps >= 20_000;
  const sheen = art.multiplierBps >= 1_000_000 ? 0.5 : art.multiplierBps >= 500_000 ? 0.42 : art.multiplierBps >= 100_000 ? 0.34 : 0.24;

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${rot.value}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${rot.value + 180}deg` }],
    opacity: interpolate(rot.value, [0, 90, 180], [0, 0, 1]),
  }));

  const flip = () => {
    if (open || disabled) return;
    setOpen(true);
    void revealFx(art.multiplier);
    onDone();
  };

  return (
    <Pressable onPress={flip} disabled={disabled} accessibilityLabel={`Flip pack card ${cardId}`} style={styles.stage}>
      {/* face down */}
      <Animated.View style={[styles.face, styles.foil, frontStyle]}>
        <View style={[styles.blob, { backgroundColor: "rgba(157,243,255,0.30)", top: -30, left: -40 }]} />
        <View style={[styles.blob, { backgroundColor: "rgba(255,122,209,0.24)", top: 40, right: -50 }]} />
        <View style={[styles.blob, { backgroundColor: "rgba(247,212,92,0.22)", bottom: -40, left: 40 }]} />
        <View style={styles.foilTop}>
          <Text style={styles.foilMark}>Stock{"\n"}Scratchers</Text>
          <View style={styles.foilTag}><Text style={styles.foilTagText}>HOLO PACK</Text></View>
        </View>
        <View style={styles.monogram}><Text style={styles.monogramText}>S</Text></View>
        <View style={styles.foilBottom}>
          <Text style={styles.foilNo}>Nº {String(cardId).padStart(4, "0")}</Text>
          <Text style={styles.foilTap}>TAP TO FLIP</Text>
        </View>
      </Animated.View>

      {/* face up */}
      <Animated.View
        style={[
          styles.face,
          styles.stock,
          dust && styles.dust,
          { borderColor: dust ? "#A9A4B3" : tier.color },
          !dust && { shadowColor: tier.glow, shadowOpacity: 0.45, shadowRadius: 18, elevation: 8 },
          backStyle,
        ]}
      >
        {holo && <View pointerEvents="none" style={[styles.sheen, { opacity: sheen }]} />}
        <View style={styles.topRow}>
          <View>
            <Text style={styles.kicker}>STOCK SCRATCHERS</Text>
            <Text style={[styles.rarity, { color: dust ? "#55505F" : tier.color }]}>{tier.label}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.ticker}>{ticker}</Text>
            <Text style={styles.payout}>{tier.payout}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {art.panels.map((s, i) => {
            const hit = art.winningPanels.includes(i);
            return (
              <View
                key={i}
                style={[
                  styles.cell,
                  hit && {
                    borderColor: dust ? "#8B8798" : tier.color,
                    backgroundColor: dust ? "rgba(85,80,95,0.10)" : `${tier.color}22`,
                  },
                ]}
              >
                <Symbol name={s} color={hit ? (dust ? "#55505F" : tier.color) : "#6E687A"} size={38} />
              </View>
            );
          })}
        </View>

        <View style={styles.foot}>
          <View>
            <Text style={styles.footKicker}>{dust ? "DUST · NOT A WIN" : art.win ? "RARITY" : "RESULT"}</Text>
            <Text style={[styles.footValue, { color: dust ? "#55505F" : tier.color }]}>{tier.payout}</Text>
          </View>
          <Text style={styles.footNo}>Nº {String(cardId).padStart(4, "0")}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: { width: W, height: H },
  face: { position: "absolute", width: W, height: H, borderRadius: 26, borderWidth: 1, padding: 16, overflow: "hidden", backfaceVisibility: "hidden" },
  foil: { backgroundColor: colors.foil, borderColor: "rgba(255,255,255,0.16)" },
  blob: { position: "absolute", width: 240, height: 240, borderRadius: 120 },
  foilTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  foilMark: { color: "rgba(255,255,255,0.82)", fontSize: 11, fontWeight: "800", letterSpacing: 2.4, lineHeight: 16 },
  foilTag: { borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  foilTagText: { color: "rgba(255,255,255,0.8)", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  monogram: { position: "absolute", left: (W - 96) / 2, top: (H - 96) / 2, width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: "rgba(255,255,255,0.28)", backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  monogramText: { color: "rgba(255,255,255,0.9)", fontSize: 40, fontWeight: "900", letterSpacing: -2 },
  foilBottom: { marginTop: "auto", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  foilNo: { color: "rgba(255,255,255,0.6)", fontSize: 10, letterSpacing: 2 },
  foilTap: { color: colors.accent, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  stock: { backgroundColor: colors.card, borderWidth: 3 },
  dust: { backgroundColor: "#DDD9E2", borderWidth: 2 },
  sheen: { position: "absolute", left: -40, right: -40, top: -40, bottom: -40, borderRadius: 26, backgroundColor: "rgba(157,243,255,0.35)" },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  kicker: { color: "rgba(23,19,32,0.55)", fontSize: 9, fontWeight: "800", letterSpacing: 2.2 },
  rarity: { fontSize: 28, fontWeight: "900", letterSpacing: -0.6, marginTop: 2 },
  ticker: { color: "rgba(23,19,32,0.6)", fontSize: 10, fontWeight: "700", letterSpacing: 1.4, textAlign: "right" },
  payout: { color: "rgba(23,19,32,0.6)", fontSize: 10, fontWeight: "700", letterSpacing: 1.4, textAlign: "right" },
  grid: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignContent: "space-between", justifyContent: "space-between", marginTop: 14, marginBottom: 12 },
  cell: { width: 84, height: 84, borderRadius: 14, borderWidth: 1, borderColor: "rgba(23,19,32,0.10)", backgroundColor: "rgba(23,19,32,0.045)", alignItems: "center", justifyContent: "center" },
  foot: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.10)", paddingTop: 10 },
  footKicker: { color: "rgba(23,19,32,0.45)", fontSize: 8, fontWeight: "800", letterSpacing: 2 },
  footValue: { fontSize: 15, fontWeight: "800", marginTop: 1 },
  footNo: { color: "rgba(23,19,32,0.45)", fontSize: 10, letterSpacing: 1.8 },
});
