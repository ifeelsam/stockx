import { Text, View } from "react-native";
import { Canvas, Circle, Group, LinearGradient, Path, RadialGradient, Rect, Skia, SweepGradient, vec } from "@shopify/react-native-skia";
import { PACK_PATH, STOCK_LOOK, type Feed } from "@scratchers/ui-tokens";
import { font } from "../theme";
import { Gem } from "./HoloCard";

const W = 220;
const H = 330;
const crimp = (y: number) => Array.from({ length: 55 }, (_, i) => `M ${i * 4 + 1} ${y} v 26`).join(" ");
const CRIMPS = `${crimp(0)} ${crimp(H - 26)}`;

export function HoloPack({ feed, count = 10, demo = false, paused = false, offset = 0, width = W }: { feed: Feed; count?: number; demo?: boolean; paused?: boolean; offset?: number; width?: number }) {
  const k = width / W;
  const p = STOCK_LOOK[feed];
  const shape = Skia.Path.MakeFromSVGString(PACK_PATH)!;
  const text = (size: number, family: string, color: string) => ({ fontFamily: family, fontSize: size * k, color, includeFontPadding: false });
  const center = { position: "absolute" as const, left: 0, right: 0, alignItems: "center" as const };
  return (
    <View style={{ width, height: H * k }} accessibilityLabel={`${p.company} pack, ${count} cards`}>
      <Canvas style={{ position: "absolute", width, height: H * k }}>
        <Group transform={[{ scale: k }]}>
          <Group clip={shape}>
            <Rect x={0} y={0} width={W} height={H} color={p.pack} />
            <Rect x={0} y={0} width={W} height={H} opacity={0.95} blendMode="softLight">
              <SweepGradient c={vec(W * (0.4 + offset * 0.3), H * 0.3)} colors={["#ff6ec7", "#7afcff", "#feff9c", "#b28dff", "#ff6ec7"]} />
            </Rect>
            <Rect x={0} y={0} width={W} height={H}>
              <LinearGradient start={vec(0, 0)} end={vec(W, 0)} colors={["rgba(0,0,0,0.42)", "rgba(0,0,0,0.08)", "rgba(255,255,255,0.10)", "rgba(255,255,255,0)", "rgba(0,0,0,0.10)", "rgba(0,0,0,0.46)"]} positions={[0, 0.14, 0.34, 0.55, 0.8, 1]} />
            </Rect>
            <Rect x={0} y={28} width={W} height={H - 56}>
              <RadialGradient c={vec(W * 0.36, H * 0.34)} r={120} colors={["rgba(255,255,255,0.40)", "rgba(255,255,255,0)"]} />
            </Rect>
            <Path path={CRIMPS} style="stroke" strokeWidth={1} color="rgba(255,255,255,0.22)" />
            <Rect x={0} y={24} width={W} height={26}>
              <LinearGradient start={vec(0, 24)} end={vec(0, 50)} colors={["rgba(0,0,0,0.38)", "rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]} />
            </Rect>
            <Rect x={0} y={H - 50} width={W} height={26}>
              <LinearGradient start={vec(0, H - 24)} end={vec(0, H - 50)} colors={["rgba(0,0,0,0.42)", "rgba(0,0,0,0)"]} />
            </Rect>
            <Circle cx={110} cy={125} r={59}>
              <LinearGradient start={vec(68, 83)} end={vec(152, 167)} colors={["rgba(0,0,0,0.22)", "rgba(255,255,255,0.10)", "rgba(255,255,255,0.40)"]} />
            </Circle>
          </Group>
        </Group>
      </Canvas>
      <View style={{ position: "absolute", left: 14 * k, right: 12 * k, top: 8 * k, flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[text(8, font.monoBold, "rgba(13,11,20,0.82)"), { letterSpacing: 1.5 * k }]}>SERIES 01 · {count} CARD{count > 1 ? "S" : ""}</Text>
        <Text style={text(8, font.monoBold, "rgba(13,11,20,0.82)")}>TEAR ›</Text>
      </View>
      {/* ticker text, not a company logo: we have no right to use one */}
      <View style={[center, { top: 103 * k }]}>
        <Text style={text(34, font.heavy, "#0D0B14")}>{p.symbol}</Text>
      </View>
      <View style={[center, { top: 194 * k }]}>
        <Text style={text(22, font.heavy, "#0D0B14")}>{p.packName}</Text>
      </View>
      <View style={[center, { top: 238 * k }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 * k, backgroundColor: "#0D0B14", borderRadius: 99, paddingHorizontal: 10 * k, paddingVertical: 6 * k }}>
          <Gem fill="#FFD84D" size={10 * k} />
          <Text style={text(10, font.monoBold, "#FFD84D")}>{demo ? "DEMO ODDS" : "GRAIL 1,000× INSIDE"}</Text>
        </View>
      </View>
      {paused && (
        <View style={{ position: "absolute", left: -16 * k, right: -16 * k, top: 138 * k, transform: [{ rotate: "-8deg" }], backgroundColor: "#0D0B14", borderWidth: 2, borderColor: "#F2EFFA", paddingVertical: 8 * k, alignItems: "center" }}>
          <Text style={text(19, font.heavy, "#F2EFFA")}>Price paused</Text>
          <Text style={text(11, font.mono, "#C9C2E6")}>waiting for a fresh price</Text>
        </View>
      )}
    </View>
  );
}
