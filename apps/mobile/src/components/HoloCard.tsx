import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import { Canvas, Circle, ColorMatrix, DashPathEffect, Group, LinearGradient, Oval, Paint, Path, Rect, RoundedRect, Skia, SweepGradient, rect, rrect, vec } from "@shopify/react-native-skia";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { FINISH, STOCK_LOOK, TIERS, type CardFace, type Feed, type TierKey } from "@scratchers/ui-tokens";
import { font } from "../theme";

const W = 286;
const H = 408;
const HOLO = ["#ff6ec7", "#7afcff", "#feff9c", "#b28dff", "#ff6ec7"];
const GRAY = [0.2126, 0.7152, 0.0722, 0, 0.04, 0.2126, 0.7152, 0.0722, 0, 0.04, 0.2126, 0.7152, 0.0722, 0, 0.04, 0, 0, 0, 1, 0];
const PAPER = rrect(rect(9, 9, 268, 390), 12, 12);

/** Original per-stock art on a 246×196 canvas (same shapes as the web SVGs). */
function Art({ feed }: { feed: Feed }) {
  if (feed === "TSLA")
    return (
      <Group>
        <Circle cx={123} cy={150} r={96} color="#FFB23F" />
        <Circle cx={123} cy={150} r={62} color="#FFE27A" />
        <Rect x={0} y={150} width={246} height={46} color="#2B1B5C" />
        <Path path="M123 150 L60 196 M123 150 L186 196" style="stroke" strokeWidth={4} color="#F2EFFA" />
        <Path path="M118 150 L104 196 M128 150 L142 196" style="stroke" strokeWidth={2} color="#F2EFFA">
          <DashPathEffect intervals={[6, 6]} />
        </Path>
        <Path path="M20 118 L60 92 L86 104 L130 60 L160 78 L206 30" style="stroke" strokeWidth={6} strokeCap="round" strokeJoin="round" color="#2B1B5C" />
      </Group>
    );
  if (feed === "NVDA")
    return (
      <Group>
        <Path path="M0 40 H246 M0 80 H246 M0 120 H246 M0 160 H246 M41 0 V196 M82 0 V196 M123 0 V196 M164 0 V196 M205 0 V196" style="stroke" strokeWidth={2} color="#0E5A35" />
        <Rect x={82} y={80} width={82} height={80} color="#0D0B14" />
        <Rect x={96} y={94} width={54} height={52} color="#B8FF5C" />
        <Path path="M82 100 H60 M82 140 H40 M164 100 H200 M164 140 H220 M110 80 V50 M136 160 V190" style="stroke" strokeWidth={4} strokeCap="round" color="#B8FF5C" />
      </Group>
    );
  return (
    <Group>
      <Group transform={[{ rotate: (-14 * Math.PI) / 180 }]} origin={vec(123, 104)}>
        <Oval x={13} y={70} width={220} height={68} style="stroke" strokeWidth={3} color="#F2EFFA" />
        <Oval x={43} y={82} width={160} height={44} style="stroke" strokeWidth={2} color="#FFD84D" />
      </Group>
      <Circle cx={123} cy={100} r={40} color="#FF8AC2" />
      <Circle cx={110} cy={88} r={12} color="#FFC2DF" />
      <Circle cx={40} cy={40} r={3} color="#F2EFFA" />
      <Circle cx={196} cy={170} r={3} color="#FFD84D" />
    </Group>
  );
}

export const Gem = ({ fill, size = 14 }: { fill: string; size?: number }) => (
  <View style={{ width: size * 0.72, height: size * 0.72, backgroundColor: fill, borderWidth: 1, borderColor: "#0D0B14", transform: [{ rotate: "45deg" }] }} />
);

const LATTICE = Array.from({ length: 36 }, (_, i) => `M ${i * 22 - 400} 9 l 390 390 M ${i * 22 - 100} 399 l 390 -390`).join(" ");

/** Face-down card. `tease` pulses a rarity-coloured glow; Dust never glows (a glow always means a real pull). */
export function CardBack({ rarity = "dust", tease = false, width = W }: { rarity?: TierKey; tease?: boolean; width?: number }) {
  const k = width / W;
  const glow = tease && rarity !== "dust";
  const pulse = useSharedValue(0.35);
  useEffect(() => {
    if (glow) pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [glow, pulse]);
  const ring = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={{ width, height: H * k }}>
      {glow && <Animated.View pointerEvents="none" style={[{ position: "absolute", left: -5, right: -5, top: -5, bottom: -5, borderRadius: 18 * k + 5, borderWidth: 5, borderColor: TIERS[rarity].color }, ring]} />}
      <Canvas style={{ width, height: H * k }}>
        <Group transform={[{ scale: k }]}>
          <RoundedRect x={0} y={0} width={W} height={H} r={18} color={glow ? FINISH[rarity].frame : "#24202F"} />
          <Group clip={PAPER}>
            <Rect x={9} y={9} width={268} height={390} color="#2B1B5C" />
            <Path path={LATTICE} style="stroke" strokeWidth={2} color="rgba(157,243,255,0.10)" />
          </Group>
          <Path path="M143 148 L185 190 L143 232 L101 190 Z" color="#0D0B14" />
          <Path path="M143 148 L185 190 L143 232 L101 190 Z M143 166 L167 190 L143 214 L119 190 Z" style="stroke" strokeWidth={2.5} color="#9DF3FF" />
        </Group>
      </Canvas>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 178 * k, alignItems: "center" }}>
        <Text style={{ fontFamily: font.heavy, fontSize: 18 * k, color: "#F2EFFA" }}>SS</Text>
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 248 * k, alignItems: "center" }}>
        <Text style={{ fontFamily: font.mono, fontSize: 11 * k, letterSpacing: 2 * k, color: "#C9C2E6" }}>STOCK SCRATCHERS</Text>
      </View>
    </View>
  );
}

/** The face-up card: frame, holo coverage and layout come from the rarity (see FINISH). */
export function HoloCard({ feed, rarity, mult, usd, shares, now, serial, tilt = 0.35, width = W }: CardFace & { width?: number }) {
  const k = width / W;
  const f = FINISH[rarity];
  const t = TIERS[rarity];
  const look = STOCK_LOOK[feed];
  const gold = rarity === "grail";
  const ink = f.full ? "#F2EFFA" : "#0D0B14";
  const head = gold ? "#FFD84D" : ink;
  const muted = f.full ? "#C9C2E6" : "#4E4864";
  const art = f.full ? { x: 9, y: 9, w: 268, h: 390, r: 12 } : { x: 19, y: 61, w: 248, h: 196, r: 6 };
  const s = Math.max(art.w / 246, art.h / 196);
  const angle = tilt * Math.PI * 2;
  const stars = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ x: ((i * 71 + 23) % 240) + 20, y: ((i * 97 + 30) % 340) + 30, r: 4 + (i % 3) * 2 })), []);
  const text = (size: number, family: string, color: string = ink) => ({ fontFamily: family, fontSize: size * k, color, includeFontPadding: false });
  return (
    <View style={{ width, height: H * k }} accessibilityLabel={`${t.label} ${look.company} card ${mult}`}>
      <Canvas style={{ position: "absolute", width, height: H * k }}>
        <Group transform={[{ scale: k }]}>
          <RoundedRect x={0} y={0} width={W} height={H} r={18} color={f.frame}>
            {rarity === "grail" && <LinearGradient start={vec(0, 0)} end={vec(W, H)} colors={["#FFF3B0", "#FFD84D", "#B8860B", "#FFE98A", "#C99A1A"]} positions={[0, 0.3, 0.55, 0.75, 1]} />}
            {rarity === "mythic" && <SweepGradient c={vec(W / 2, H / 2)} colors={["#ff6ec7", "#ffb86b", "#feff9c", "#7afcff", "#b28dff", "#ff6ec7"]} />}
          </RoundedRect>
          <RoundedRect x={9} y={9} width={268} height={390} r={12} color={f.full ? "#0D0B14" : "#F2EFFA"} />
          <Group clip={rrect(rect(art.x, art.y, art.w, art.h), art.r, art.r)}>
            <Group layer={rarity === "dust" ? <Paint><ColorMatrix matrix={GRAY} /></Paint> : undefined}>
              <Rect x={art.x} y={art.y} width={art.w} height={art.h} color={look.art} />
              <Group transform={[{ translateX: art.x + (art.w - 246 * s) / 2 }, { translateY: art.y + (art.h - 196 * s) / 2 }, { scale: s }]}>
                <Art feed={feed} />
              </Group>
            </Group>
            {f.holo > 0 && (
              <Rect x={art.x} y={art.y} width={art.w} height={art.h} opacity={f.holo} blendMode="colorDodge">
                <SweepGradient c={vec(art.x + art.w * tilt, art.y + art.h * 0.4)} colors={HOLO} origin={vec(art.x + art.w * tilt, art.y + art.h * 0.4)} transform={[{ rotate: angle }]} />
              </Rect>
            )}
            {f.full && (
              <Rect x={art.x} y={art.y} width={art.w} height={art.h}>
                <LinearGradient start={vec(0, art.y)} end={vec(0, art.y + art.h)} colors={["rgba(13,11,20,0.55)", "rgba(13,11,20,0)", "rgba(13,11,20,0)", "rgba(13,11,20,0.82)", "rgba(13,11,20,0.92)"]} positions={[0, 0.22, 0.52, 0.78, 1]} />
              </Rect>
            )}
          </Group>
          <Rect x={9} y={367} width={268} height={1} color={f.full ? "rgba(242,239,250,0.22)" : "#D9D4E6"} />
          <Group clip={PAPER}>
            {f.cardHolo > 0 && (
              <Rect x={9} y={9} width={268} height={390} opacity={f.cardHolo} blendMode="colorDodge">
                <SweepGradient c={vec(W * tilt, H * 0.4)} colors={HOLO} />
              </Rect>
            )}
            {f.holo > 0 && (
              <Rect x={9} y={9} width={268} height={390} blendMode="overlay">
                <LinearGradient start={vec(0, 0)} end={vec(W, H * 0.5)} colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.6)", "rgba(255,255,255,0)"]} positions={[tilt * 0.6, tilt * 0.6 + 0.08, tilt * 0.6 + 0.18]} />
              </Rect>
            )}
            {f.sparkle &&
              stars.map((p, i) => (
                <Path key={i} color={["#FFFFFF", "#FFE98A", "#FFD84D"][i % 3]} path={Skia.Path.MakeFromSVGString(`M ${p.x} ${p.y - p.r} Q ${p.x + 1} ${p.y - 1} ${p.x + p.r} ${p.y} Q ${p.x + 1} ${p.y + 1} ${p.x} ${p.y + p.r} Q ${p.x - 1} ${p.y + 1} ${p.x - p.r} ${p.y} Q ${p.x - 1} ${p.y - 1} ${p.x} ${p.y - p.r} Z`)!} />
              ))}
          </Group>
        </Group>
      </Canvas>

      <View style={{ position: "absolute", left: 21 * k, right: 21 * k, top: 17 * k, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={text(26, font.heavy, head)}>{look.symbol}</Text>
        <View style={[{ flexDirection: "row", alignItems: "center", gap: 6 * k, borderRadius: 99 }, f.filledBadge && { backgroundColor: t.color, paddingHorizontal: 8 * k, paddingVertical: 3 * k }]}>
          <Gem fill={f.filledBadge ? "#0D0B14" : t.color} size={14 * k} />
          <Text style={text(11, font.monoBold, f.filledBadge || !f.full ? "#0D0B14" : ink)}>{t.label.toUpperCase()}</Text>
        </View>
      </View>
      <View style={{ position: "absolute", left: 21 * k, right: 21 * k, top: (f.full ? 282 : 264) * k, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={[text(54, font.heavy, head), { lineHeight: 60 * k, letterSpacing: -2 * k }]}>{mult}</Text>
        <Text style={text(18, font.bold)}>{usd}</Text>
      </View>
      <View style={{ position: "absolute", left: 21 * k, right: 21 * k, top: (f.full ? 346 : 330) * k, flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={text(11, font.mono)}>{shares}</Text>
        <Text style={text(11, font.mono)}>{now}</Text>
      </View>
      <View style={{ position: "absolute", left: 21 * k, right: 21 * k, top: 375 * k, flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={text(10, font.mono, muted)}>Series 01 · {look.company}</Text>
        <Text style={text(10, font.mono, muted)}>№ {serial}</Text>
      </View>
    </View>
  );
}
