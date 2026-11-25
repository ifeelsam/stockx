import { Modal, Pressable, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { seriesById, useGame, type UiCard } from "@scratchers/app-core";
import { colors, describeCard, money } from "@scratchers/ui-tokens";
import { font, ui } from "../theme";
import { HoloCard } from "./HoloCard";
import { CoinBurst } from "./CoinBurst";
import { CountUp } from "./CountUp";

/** Full-screen Grail moment (design "04 · Grail pull"). A Rive file can replace the backdrop later (see docs/DECISIONS.md). */
export function JackpotOverlay({ card, onClose, onClaim, onProof }: { card: (UiCard & { art: NonNullable<UiCard["art"]> }) | null; onClose: () => void; onClaim: () => void; onProof: (id: number) => void }) {
  const g = useGame();
  if (!card) return null;
  const s = seriesById(card.seriesId);
  const v = describeCard(card, s, g.prices[s.feed]);
  const big = { fontFamily: font.heavy, fontSize: 150, lineHeight: 158, letterSpacing: -8, color: colors.gold, includeFontPadding: false };
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", padding: 20 }}>
        <View pointerEvents="none" style={{ position: "absolute", left: -10, top: 60, width: 640 }}>
          <Text numberOfLines={1} style={big}>GRAIL</Text>
          <Text numberOfLines={1} style={[big, { opacity: 0.35 }]}>GRAIL</Text>
        </View>
        <Animated.View entering={ZoomIn.springify().damping(14).stiffness(160)} style={{ transform: [{ rotate: "-3deg" }] }}>
          <HoloCard {...v.face} width={286} />
        </Animated.View>
        <CoinBurst colors={[v.tier.color, v.tier.glow, "#fff"]} count={48} spread={220} />
        <Text style={[ui.h1, { marginTop: 22 }]}>A Grail {s.feed}.</Text>
        <CountUp to={v.usd} style={{ fontFamily: font.heavy, fontSize: 28, color: colors.gold }} />
        <Text style={ui.soft}>{money(v.usd)} in {s.ticker}{s.demo ? " · demo odds" : ""}</Text>
        <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 22 }}>
          <Pressable onPress={() => onProof(card.id)} style={[ui.btn, { flex: 1, borderWidth: 2, borderColor: colors.gold }]}><Text style={[ui.btnText, { color: colors.gold }]}>See the proof</Text></Pressable>
          <Pressable onPress={onClaim} style={[ui.btn, { flex: 1.4, backgroundColor: colors.gold }]}><Text style={ui.btnText}>Add to binder</Text></Pressable>
        </View>
        <Pressable onPress={onClose} style={{ padding: 12 }}><Text style={ui.dim}>Close</Text></Pressable>
      </View>
    </Modal>
  );
}
