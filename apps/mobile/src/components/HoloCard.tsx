import { useEffect } from "react";
import { Text, View } from "react-native";
import { Blur, BlurMask, Canvas, Circle, ColorMatrix, Group, LinearGradient, Oval, Paint, Path, Points, RadialGradient, Rect, RoundedRect, SweepGradient, rect, rrect, vec } from "@shopify/react-native-skia";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { CARD_ART as A, CARD_BACK as B, FINISH, LOGO, SPARKLES, STOCK_LOOK, TIERS, type CardFace, type CardTheme, type TierKey } from "@scratchers/ui-tokens";
import { font } from "../theme";
import { Wordmark } from "./Logo";

const W = A.w;
const H = A.h;

// face-up card: everything below is drawn in the inner (framed) area's coordinates
const IW = W - A.inset * 2;
const IH = H - A.inset * 2;
const INNER = rrect(rect(0, 0, IW, IH), 11, 11);
/** room around the card for its glow */
const PAD = 26;
const DOTS = Array.from({ length: Math.ceil(IH / 7) * Math.ceil(IW / 7) }, (_, i) => vec((i % Math.ceil(IW / 7)) * 7 + 3.5, Math.floor(i / Math.ceil(IW / 7)) * 7 + 3.5));
const RAYS = Array.from({ length: 24 }, (_, i) => {
  const at = (deg: number) => `${A.cx + 220 * Math.sin((deg * Math.PI) / 180)} ${A.cy - 220 * Math.cos((deg * Math.PI) / 180)}`;
  return `M ${A.cx} ${A.cy} L ${at(i * 15)} L ${at(i * 15 + 5)} Z`;
}).join(" ");

/** The ends of a CSS `linear-gradient(<deg>deg, …)` over the inner area, so foil angles match the web. */
const cssLine = (deg: number) => {
  const dx = Math.sin((deg * Math.PI) / 180);
  const dy = -Math.cos((deg * Math.PI) / 180);
  const half = (Math.abs(IW * dx) + Math.abs(IH * dy)) / 2;
  return { start: vec(IW / 2 - dx * half, IH / 2 - dy * half), end: vec(IW / 2 + dx * half, IH / 2 + dy * half) };
};

/** CSS saturate(s), then brightness(b). */
const toneMatrix = (s: number, b = 1) => {
  const [r, g, bl] = [0.2126 * (1 - s), 0.7152 * (1 - s), 0.0722 * (1 - s)];
  return [(r + s) * b, g * b, bl * b, 0, 0, r * b, (g + s) * b, bl * b, 0, 0, r * b, g * b, (bl + s) * b, 0, 0, 0, 0, 0, 1, 0];
};

/** Places the 24-unit logo in a `size` box at (x, y), as the web's padded viewBox does. */
const logoAt = (x: number, y: number, size: number) => {
  const k = size / 28;
  return [{ translateX: x + 2 * k }, { translateY: y + 1.5 * k }, { scale: k }];
};

/** The brand mark as a glossy raised badge. */
function BrandMark({ c, glow }: { c: CardTheme; glow: string }) {
  const [x1, y1, x2, y2] = c.line;
  return (
    <Group transform={logoAt(A.cx - c.size / 2, A.cy - c.size / 2, c.size)}>
      <Path path={c.logo} color={glow} opacity={0.65}>
        <BlurMask blur={2.2} style="normal" />
      </Path>
      {[6, 5, 4, 3, 2, 1].map((i) => (
        <Group key={i} transform={[{ translateY: i * 0.13 }]}>
          <Path path={c.logo} color={c.extrude[i > 3 ? 0 : 1]} />
        </Group>
      ))}
      <Path path={c.logo}>
        <LinearGradient start={vec(x1 * 24, y1 * 24)} end={vec(x2 * 24, y2 * 24)} colors={c.face} positions={[0, 0.28, 0.62, 1]} />
      </Path>
      <Path path={c.logo}>
        <LinearGradient start={vec(0, 0)} end={vec(24, 24)} colors={["#ffffff00", "#ffffff8c", "#ffffff00"]} positions={[0.3, 0.46, 0.56]} />
      </Path>
      <Path path={c.logo} style="stroke" strokeWidth={0.09} color={c.rim} opacity={0.7} />
    </Group>
  );
}

export const Gem = ({ fill, size = 14 }: { fill: string; size?: number }) => (
  <View style={{ width: size * 0.72, height: size * 0.72, backgroundColor: fill, borderWidth: 1, borderColor: "#0D0B14", transform: [{ rotate: "45deg" }] }} />
);

const BACK_RAYS = Array.from({ length: 30 }, (_, i) => {
  const at = (deg: number) => `${A.cx + 170 * Math.sin((deg * Math.PI) / 180)} ${B.cy - 170 * Math.cos((deg * Math.PI) / 180)}`;
  return `M ${A.cx} ${B.cy} L ${at(i * 12)} L ${at(i * 12 + 3)} Z`;
}).join(" ");
const CORNERS = [[19.5, 19.5], [249.5, 19.5], [19.5, 371.5], [249.5, 371.5]].map(([x, y]) => `M ${x} ${y - 5} L ${x + 5} ${y} L ${x} ${y + 5} L ${x - 5} ${y} Z`).join(" ");
/** The brand mark, 92 high, centred in the medallion (its viewBox is x 10..54, y 0..60). */
const MARK = [{ translateX: A.cx - 32 * (92 / 60) }, { translateY: B.cy - 30 * (92 / 60) }, { scale: 92 / 60 }];

/**
 * Face-down card: the same foil as the faces, in the house colours, so it gives nothing away.
 * `tease` pulses it in the rarity colour; Dust never glows (a glow always means a real pull).
 */
export function CardBack({ rarity = "dust", tease = false, width = W }: { rarity?: TierKey; tease?: boolean; width?: number }) {
  const k = width / W;
  const glow = tease && rarity !== "dust";
  const pulse = useSharedValue(0.35);
  useEffect(() => {
    if (glow) pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [glow, pulse]);
  const halo = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const edge = glow ? FINISH[rarity].edge : B.edge;
  const ring = glow ? [...FINISH[rarity].edge, FINISH[rarity].edge[0]] : B.ring;
  const light = glow ? TIERS[rarity].color : B.light;
  const bleed = { position: "absolute" as const, left: -PAD * k, top: -PAD * k, width: (W + PAD * 2) * k, height: (H + PAD * 2) * k };
  const centred = (top: number) => ({ position: "absolute" as const, left: 0, right: 0, top: top * k, alignItems: "center" as const });
  const caps = (size: number, spacing: number, color: string) => ({ fontFamily: font.mono, fontSize: size * k, letterSpacing: spacing * k, color, includeFontPadding: false });
  return (
    <View style={{ width, height: H * k }}>
      {glow && (
        <Animated.View pointerEvents="none" style={[bleed, halo]}>
          <Canvas style={{ flex: 1 }}>
            <Group transform={[{ scale: k }, { translateX: PAD }, { translateY: PAD }]}>
              <RoundedRect x={0} y={0} width={W} height={H} r={18} color={light}>
                <BlurMask blur={15} style="normal" />
              </RoundedRect>
            </Group>
          </Canvas>
        </Animated.View>
      )}
      <Canvas style={{ width, height: H * k }}>
        <Group transform={[{ scale: k }]}>
          <RoundedRect x={0} y={0} width={W} height={H} r={18}>
            <LinearGradient start={vec(0, 0)} end={vec(W, H)} colors={edge} />
          </RoundedRect>
          <Group transform={[{ translateX: A.inset }, { translateY: A.inset }]}>
            <Group clip={INNER}>
              <Rect x={0} y={0} width={IW} height={IH}>
                <RadialGradient c={vec(IW / 2, IH * 0.44)} r={243} colors={B.bg} positions={[0, 0.42, 0.75, 1]} />
              </Rect>
              <Path path={BACK_RAYS}>
                <RadialGradient c={vec(A.cx, B.cy)} r={165} colors={[`${light}38`, `${light}38`, `${light}00`]} positions={[0, 0.3, 1]} />
              </Path>
              <Rect x={0} y={0} width={IW} height={IH} blendMode="screen">
                <LinearGradient {...cssLine(118)} colors={A.streaks.map(([, tn, a]) => `${tn === "white" ? "#ffffff" : light}${a}`)} positions={A.streaks.map(([pos]) => pos)} />
              </Rect>
              <Points points={DOTS} mode="points" color="#ffffff" opacity={0.17} strokeWidth={1.2} strokeCap="round" />
              {B.rings.map((r, i) => (
                <Circle key={r} cx={A.cx} cy={B.cy} r={r} style="stroke" strokeWidth={1} color={light} opacity={0.3 - i * 0.09} />
              ))}
              <Circle cx={A.cx} cy={B.cy} r={B.medallion} color={light} opacity={0.65}>
                <BlurMask blur={13} style="normal" />
              </Circle>
              <Circle cx={A.cx} cy={B.cy} r={B.medallion}>
                <SweepGradient c={vec(A.cx, B.cy)} colors={ring} origin={vec(A.cx, B.cy)} transform={[{ rotate: (120 * Math.PI) / 180 }]} />
              </Circle>
              <Circle cx={A.cx} cy={B.cy} r={B.medallion - 3}>
                <RadialGradient c={vec(A.cx, B.cy - 27)} r={106} colors={["#34265F", "#120D28", "#0B0818"]} positions={[0, 0.68, 1]} />
              </Circle>
              <Circle cx={A.cx} cy={B.cy} r={B.medallion - 5.5} style="stroke" strokeWidth={5} color="#0B0818" />
              <Circle cx={A.cx} cy={B.cy} r={B.medallion - 8.5} style="stroke" strokeWidth={1} color="#ffffff22" />
              <Group transform={MARK}>
                {[LOGO.top, LOGO.bottom].map((d) => (
                  <Path key={d} path={d} color={light} opacity={0.6}>
                    <BlurMask blur={6} style="normal" />
                  </Path>
                ))}
                <Group transform={[{ translateY: 2 }]}>
                  <Path path={LOGO.top} color="#05030C" />
                  <Path path={LOGO.bottom} color="#05030C" />
                </Group>
                <Path path={LOGO.top} color="#F2EFFA" />
                <Path path={LOGO.bottom}>
                  <LinearGradient start={vec(12, 58)} end={vec(52, 21)} colors={[...LOGO.holo]} />
                </Path>
              </Group>
              <Rect x={0} y={0} width={IW} height={IH} opacity={0.2} blendMode="colorDodge">
                <LinearGradient {...cssLine(125)} colors={A.holo.map(([, color]) => color)} positions={A.holo.map(([pos]) => pos)} />
              </Rect>
              <Rect x={0} y={0} width={IW} height={IH} opacity={0.6} blendMode="overlay">
                <LinearGradient {...cssLine(121)} colors={["#ffffff00", "#ffffffaa", "#ffffff00"]} positions={[0.22, 0.31, 0.42]} />
              </Rect>
              <RoundedRect x={9.5} y={9.5} width={IW - 19} height={IH - 19} r={6} style="stroke" strokeWidth={1} color="#ffffff26" />
              <Path path={CORNERS} color={light} />
            </Group>
          </Group>
        </Group>
      </Canvas>
      <View pointerEvents="none" style={centred(A.inset + 24)}>
        <Text style={caps(9, 4.5, "#C9C2E6")}>SERIES 01</Text>
      </View>
      <View pointerEvents="none" style={centred(A.inset + 298)}>
        <Wordmark size={36 * k} />
      </View>
      <View pointerEvents="none" style={centred(A.inset + 358)}>
        <Text style={caps(8.5, 2.5, "#A9A3BC")}>{B.foot.toUpperCase()}</Text>
      </View>
    </View>
  );
}

/** The face-up card: foil art in the company's colours; frame, foil and effects come from the rarity (see FINISH). */
export function HoloCard({ feed, rarity, mult, usd, shares, now, serial, tilt = 0.35, width = W }: CardFace & { width?: number }) {
  const k = width / W;
  const f = FINISH[rarity];
  const t = TIERS[rarity];
  const look = STOCK_LOOK[feed];
  const c = look.card;
  const gold = rarity === "grail";
  const dust = rarity === "dust";
  const ink = gold ? "#FFD84D" : "#FFFFFF";
  const sheen = 0.22 + (tilt - 0.35) * 0.4;
  const tone = dust ? toneMatrix(0, 0.78) : f.saturation < 1 ? toneMatrix(f.saturation) : undefined;
  const text = (size: number, family: string, color: string = "#F2EFFA") => ({ fontFamily: family, fontSize: size * k, color, includeFontPadding: false });
  const row = (top: number) => ({ position: "absolute" as const, left: (A.inset + 13) * k, right: (A.inset + 13) * k, top: (A.inset + top) * k, flexDirection: "row" as const, justifyContent: "space-between" as const });
  return (
    <View style={{ width, height: H * k }} accessibilityLabel={`${t.label} ${look.company} card ${mult}`}>
      <Canvas style={{ position: "absolute", left: -PAD * k, top: -PAD * k, width: (W + PAD * 2) * k, height: (H + PAD * 2) * k }}>
        <Group transform={[{ scale: k }, { translateX: PAD }, { translateY: PAD }]}>
          {f.glow && (
            <RoundedRect x={4} y={4} width={W - 8} height={H - 8} r={18} color={t.color} opacity={0.5}>
              <BlurMask blur={13} style="normal" />
            </RoundedRect>
          )}
          <RoundedRect x={0} y={0} width={W} height={H} r={18}>
            {rarity === "mythic" ? <SweepGradient c={vec(W / 2, H / 2)} colors={f.edge} /> : <LinearGradient start={vec(0, 0)} end={vec(W, H)} colors={f.edge} />}
          </RoundedRect>
          <Group transform={[{ translateX: A.inset }, { translateY: A.inset }]}>
            <Group clip={INNER}>
              <Group layer={tone ? <Paint><ColorMatrix matrix={tone} /></Paint> : undefined}>
                <Rect x={0} y={0} width={IW} height={IH}>
                  <RadialGradient c={vec(IW / 2, IH * 0.4)} r={243} colors={c.bg} positions={[0, 0.42, 0.75, 1]} />
                </Rect>
                <Group transform={logoAt(A.mark.x, c.mark.y, A.mark.size)} opacity={c.mark.alpha}>
                  <Path path={c.logo}>
                    <LinearGradient start={vec(0, 2)} end={vec(0, 17)} colors={["#ffffffff", "#ffffff00"]} />
                  </Path>
                </Group>
                {f.rays && (
                  <Group>
                    <Rect x={0} y={0} width={IW} height={IH}>
                      <RadialGradient c={vec(A.cx, A.cy)} r={150} colors={["#ffd84d88", "#ffd84d22", "#ffd84d00"]} positions={[0, 0.5, 1]} />
                    </Rect>
                    <Path path={RAYS}>
                      <RadialGradient c={vec(A.cx, A.cy)} r={180} colors={["#ffe98a55", "#ffe98a44", "#ffe98a00"]} positions={[0, 0.3, 1]} />
                    </Path>
                  </Group>
                )}
                <Rect x={0} y={0} width={IW} height={IH} blendMode="screen">
                  <LinearGradient {...cssLine(118)} colors={A.streaks.map(([, tn, a]) => `${tn === "white" ? "#ffffff" : look.glow}${a}`)} positions={A.streaks.map(([pos]) => pos)} />
                </Rect>
                <Points points={DOTS} mode="points" color="#ffffff" opacity={0.17} strokeWidth={1.2} strokeCap="round" />
                {[103, 131].map((r, i) => (
                  <Circle key={r} cx={A.cx} cy={A.cy} r={r} style="stroke" strokeWidth={1} color={c.soft} opacity={i ? 0.13 : 0.28} />
                ))}
                <Oval x={45} y={228} width={180} height={26} color={look.glow} opacity={0.6}>
                  <Blur blur={7} />
                </Oval>
                <BrandMark c={c} glow={look.glow} />
              </Group>

              {f.holo > 0 && (
                <Group>
                  <Rect x={0} y={0} width={IW} height={IH} opacity={f.holo * 0.34} blendMode="colorDodge">
                    <LinearGradient {...cssLine(125)} colors={A.holo.map(([, color]) => color)} positions={A.holo.map(([pos]) => pos)} />
                  </Rect>
                  <Rect x={0} y={0} width={IW} height={IH} opacity={f.holo} blendMode="overlay">
                    <LinearGradient {...cssLine(121)} colors={["#ffffff00", "#ffffffaa", "#ffffff00"]} positions={[sheen, sheen + 0.09, sheen + 0.2]} />
                  </Rect>
                </Group>
              )}
              {f.sparkle &&
                SPARKLES.map((p, i) => (
                  <Path key={i} color={p.color} path={`M ${p.x} ${p.y - p.r} Q ${p.x + 1} ${p.y - 1} ${p.x + p.r} ${p.y} Q ${p.x + 1} ${p.y + 1} ${p.x} ${p.y + p.r} Q ${p.x - 1} ${p.y + 1} ${p.x - p.r} ${p.y} Q ${p.x - 1} ${p.y - 1} ${p.x} ${p.y - p.r} Z`} />
                ))}

              <Rect x={0} y={A.panelY} width={IW} height={IH - A.panelY}>
                <LinearGradient start={vec(0, A.panelY)} end={vec(0, IH)} colors={[`${c.panel}c8`, `${c.panel}f4`]} />
              </Rect>
              <Rect x={0} y={A.panelY} width={IW} height={1} color={t.color} opacity={0.4} />
              <Rect x={13} y={362} width={IW - 26} height={1} color="#ffffff" opacity={0.15} />
            </Group>
            {gold && <RoundedRect x={0.75} y={0.75} width={IW - 1.5} height={IH - 1.5} r={10.5} style="stroke" strokeWidth={1.5} color="#FFD84DBB" />}
          </Group>
        </Group>
      </Canvas>

      <View style={[row(11), { alignItems: "flex-start" }]}>
        <View>
          <Text style={[text(28, font.heavy, ink), { lineHeight: 30 * k, letterSpacing: -0.5 * k }]}>{look.symbol}</Text>
          <Text style={[text(9, font.mono, c.caption), { letterSpacing: 4.5 * k }]}>{look.company.toUpperCase()}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 * k, borderRadius: 99, borderWidth: 1, borderColor: dust ? "#5A546E" : t.color, backgroundColor: dust ? "#0D0B14AA" : t.color, paddingHorizontal: 9 * k, paddingVertical: 3 * k }}>
          <Gem fill={dust ? t.color : "#0D0B14"} size={11 * k} />
          <Text style={text(10.5, font.monoBold, dust ? "#B4AEC6" : "#0D0B14")}>{t.label.toUpperCase()}</Text>
        </View>
      </View>
      <View style={[row(285), { alignItems: "baseline" }]}>
        <Text style={[text(50, font.heavy, dust ? "#C9C2D8" : ink), { lineHeight: 56 * k, letterSpacing: -2 * k }]}>{mult}</Text>
        <Text style={text(20, font.bold)}>{usd}</Text>
      </View>
      <View style={row(341)}>
        <Text style={text(10.5, font.mono, "#E4DFF2")}>{shares}</Text>
        <Text style={text(10.5, font.mono, now?.includes("\u25bc") ? "#FF8A7A" : dust ? "#C9C2D8" : "#9DF3FF")}>{now}</Text>
      </View>
      <View style={row(369)}>
        <Text style={text(8.5, font.mono, "#A9A3BC")}>SERIES 01 · {look.company.toUpperCase()}</Text>
        <Text style={text(8.5, font.mono, "#A9A3BC")}>№ {serial}</Text>
      </View>
    </View>
  );
}
