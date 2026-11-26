import { Text, View } from "react-native";
import { Canvas, Group, Image, Oval, RadialGradient, Skia, useImage, vec } from "@shopify/react-native-skia";
import { STOCK_LOOK, type Feed } from "@scratchers/ui-tokens";
import { font } from "../theme";
import { Gem } from "./HoloCard";

const W = 220;
const H = 330;
const ART: Record<Feed, number> = {
  TSLA: require("../../../../packages/ui-tokens/art/tsla.png"),
  NVDA: require("../../../../packages/ui-tokens/art/nvda.png"),
  SOL: require("../../../../packages/ui-tokens/art/sol.png"),
};

/** Where the pack tears, in 220×330 pack units. */
export const SEAM_Y = 33; // just under the top seal in the art
const jag = Array.from({ length: 33 }, (_, i) => `L ${Math.min(i * 7, W)} ${SEAM_Y + (((i * 7) % 3) - 1) * 2.4}`).join(" ").slice(2);
const HALVES = { strip: `M 0 -4 L 0 ${SEAM_Y} L ${jag} L ${W} -4 Z`, body: `M ${jag} L ${W} ${H + 4} L 0 ${H + 4} Z` };

/** The foil pack: rendered art, with what changes (card count, demo odds, paused price) drawn on top. */
export function HoloPack({ feed, count = 10, demo = false, paused = false, width = W, part }: { feed: Feed; count?: number; demo?: boolean; paused?: boolean; width?: number; part?: keyof typeof HALVES }) {
  const k = width / W;
  const p = STOCK_LOOK[feed];
  const art = useImage(ART[feed]);
  // one side of the jagged tear line
  const half = part ? Skia.Path.MakeFromSVGString(HALVES[part])! : undefined;
  const text = (size: number, family: string, color: string) => ({ fontFamily: family, fontSize: size * k, color, includeFontPadding: false });
  return (
    <View style={{ width, height: H * k }} accessibilityLabel={`${p.company} pack, ${count} cards`}>
      {!part && (
        <Canvas style={{ position: "absolute", left: 0, top: (H - 14) * k, width, height: 34 * k }}>
          <Oval x={0} y={0} width={width} height={34 * k}>
            <RadialGradient c={vec(width / 2, 17 * k)} r={width / 2} colors={[`${p.glow}70`, `${p.glow}00`]} />
          </Oval>
        </Canvas>
      )}
      <Canvas style={{ position: "absolute", width, height: H * k }}>
        <Group transform={[{ scale: k }]}>
          <Group clip={half}>{art && <Image image={art} x={0} y={0} width={W} height={H} fit="fill" />}</Group>
        </Group>
      </Canvas>
      <View style={{ position: "absolute", left: 30 * k, right: 22 * k, top: 12 * k, flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[text(8, font.monoBold, p.foilInk), { letterSpacing: k }]}>SERIES 01 · {count} CARD{count > 1 ? "S" : ""}</Text>
        <Text style={text(8, font.monoBold, p.foilInk)}>TEAR ▸</Text>
      </View>
      {/* covers the printed Grail line: demo odds must never look like the real ones */}
      {demo && (
        <View style={{ position: "absolute", left: 39 * k, top: 246 * k, width: 142 * k, height: 31 * k, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 * k, backgroundColor: "#0D0B14", borderWidth: 1, borderColor: "#FFD84D", borderRadius: 99 }}>
          <Gem fill="#FFD84D" size={10 * k} />
          <Text style={text(11, font.monoBold, "#FFD84D")}>DEMO ODDS</Text>
        </View>
      )}
      {paused && (
        <View style={{ position: "absolute", left: -16 * k, right: -16 * k, top: 138 * k, transform: [{ rotate: "-8deg" }], backgroundColor: "#0D0B14", borderWidth: 2, borderColor: "#F2EFFA", paddingVertical: 8 * k, alignItems: "center" }}>
          <Text style={text(19, font.heavy, "#F2EFFA")}>Price paused</Text>
          <Text style={text(11, font.mono, "#C9C2E6")}>waiting for a fresh price</Text>
        </View>
      )}
    </View>
  );
}
