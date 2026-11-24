import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Canvas, Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { colors, SCRATCH_REVEAL_THRESHOLD, tierByMultiplier } from "@scratchers/ui-tokens";
import type { CardArt } from "@scratchers/sdk/pure";
import { Symbol } from "./Symbol";
import { revealFx } from "../lib/fx";

const SIZE = 300;
const BRUSH = 44;
const GRID = 12; // coverage grid: reveal once 60% of cells have been scratched

export function ScratchCard({ art, scratched, onDone, disabled }: { art: CardArt; scratched: boolean; onDone: () => void; disabled?: boolean }) {
  const [cleared, setCleared] = useState(scratched);
  // PathBuilder is mutable; Skia draws an immutable snapshot, rebuilt after each stroke segment
  const builder = useMemo(() => Skia.PathBuilder.Make(), []);
  const [path, setPath] = useState(() => builder.build());
  const hit = useRef(new Set<number>());
  const ticks = useRef(0);
  const tier = tierByMultiplier(art.multiplier);

  const finish = useCallback(() => {
    setCleared(true);
    revealFx(art.multiplier);
    onDone();
  }, [art.multiplier, onDone]);

  const mark = (x: number, y: number) => {
    const r = BRUSH / 2;
    const cell = SIZE / GRID;
    for (let gx = Math.max(0, Math.floor((x - r) / cell)); gx <= Math.min(GRID - 1, Math.floor((x + r) / cell)); gx++)
      for (let gy = Math.max(0, Math.floor((y - r) / cell)); gy <= Math.min(GRID - 1, Math.floor((y + r) / cell)); gy++) {
        const cx = (gx + 0.5) * cell, cy = (gy + 0.5) * cell;
        if ((cx - x) ** 2 + (cy - y) ** 2 <= r * r) hit.current.add(gy * GRID + gx);
      }
    if (++ticks.current % 6 === 0) Haptics.selectionAsync();
    if (hit.current.size / (GRID * GRID) >= SCRATCH_REVEAL_THRESHOLD) finish();
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(!cleared && !disabled)
    .minDistance(0)
    .onBegin((e) => {
      builder.moveTo(e.x, e.y).lineTo(e.x + 0.1, e.y);
      mark(e.x, e.y);
      setPath(builder.build());
    })
    .onUpdate((e) => {
      builder.lineTo(e.x, e.y);
      mark(e.x, e.y);
      setPath(builder.build());
    });

  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <View style={[styles.grid, cleared && art.win && { borderColor: tier.color }]}>
        {art.panels.map((s, i) => {
          const win = cleared && art.winningPanels.includes(i);
          return (
            <View key={i} style={[styles.cell, win && { backgroundColor: tier.color + "22", borderColor: tier.color, borderWidth: 1.5 }]}>
              <Symbol name={s} color={win ? tier.color : colors.textDim} size={44} />
            </View>
          );
        })}
      </View>
      {!cleared && (
        <GestureDetector gesture={pan}>
          <View style={StyleSheet.absoluteFill}>
            <Canvas style={{ width: SIZE, height: SIZE }}>
              <Group layer>
                <Rect x={0} y={0} width={SIZE} height={SIZE}>
                  <LinearGradient start={vec(0, 0)} end={vec(SIZE, SIZE)} colors={["#3A4154", "#6B7390", "#2A2F3D"]} />
                </Rect>
                <Path path={path} style="stroke" strokeWidth={BRUSH} strokeCap="round" strokeJoin="round" blendMode="clear" />
              </Group>
            </Canvas>
            <Text style={styles.hint} pointerEvents="none">SCRATCH HERE</Text>
          </View>
        </GestureDetector>
      )}
      {!cleared && !disabled && (
        <Text style={styles.reveal} onPress={finish}>reveal all</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { ...StyleSheet.absoluteFill, flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  cell: { width: (SIZE - 24 - 16) / 3, height: (SIZE - 24 - 16) / 3, borderRadius: 12, backgroundColor: colors.surfaceHi, alignItems: "center", justifyContent: "center" },
  hint: { position: "absolute", top: SIZE / 2 - 10, width: SIZE, textAlign: "center", color: "rgba(255,255,255,0.55)", fontWeight: "600", fontSize: 18 },
  reveal: { position: "absolute", bottom: -26, alignSelf: "center", color: colors.textDim, textDecorationLine: "underline", fontSize: 12 },
});
