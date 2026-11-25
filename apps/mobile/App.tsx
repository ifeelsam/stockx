import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StatusBar, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { PrivyProvider } from "@privy-io/expo";
import { useFonts } from "expo-font";
import { BricolageGrotesque_500Medium, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { SpaceMono_400Regular, SpaceMono_700Bold } from "@expo-google-fonts/space-mono";
import { useGame } from "@scratchers/app-core";
import { colors, money } from "@scratchers/ui-tokens";
import { env } from "./src/env";
import { WalletProvider, useWallet } from "./src/lib/wallets";
import { GameHost } from "./src/lib/GameHost";
import { Banners } from "./src/components/Banners";
import { Login } from "./src/screens/Login";
import { Play } from "./src/screens/Play";
import { Portfolio } from "./src/screens/Portfolio";
import { Verify } from "./src/screens/Verify";
import { Dev } from "./src/screens/Dev";
import { font, ui } from "./src/theme";

type Tab = "packs" | "binder" | "proof" | "dev";
// the wallet self-test screen is for development builds only
const TABS: [Tab, string][] = [["packs", "Packs"], ["binder", "Binder"], ["proof", "Proof"], ...(__DEV__ ? [["dev", "Dev"] as [Tab, string]] : [])];

function Shell() {
  const w = useWallet();
  const g = useGame();
  const [tab, setTab] = useState<Tab>("packs");
  const [proof, setProof] = useState("");
  const [funding, setFunding] = useState(false);
  if (!w.kind) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }}><Login /></SafeAreaView>;
  const addFunds = async () => {
    setFunding(true);
    try {
      await g.faucet();
    } catch (e) {
      Alert.alert("Could not add funds", e instanceof Error ? e.message : String(e));
    } finally {
      setFunding(false);
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }}>
      <View style={[ui.row, { gap: 10, paddingHorizontal: 20, paddingVertical: 8 }]}>
        <Text style={[ui.h2, { fontSize: 19, flex: 1 }]} numberOfLines={1}>ripStokx</Text>
        <Pressable onPress={addFunds} disabled={funding} accessibilityLabel={`Balance ${money(g.usdc)}. Add 100 test USDC`} style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, borderColor: "#3A3350", justifyContent: "center" }}>
          <Text style={[ui.mono, { fontFamily: font.monoBold }]}>{funding ? "adding…" : `${money(g.usdc)} +`}</Text>
        </Pressable>
        <Pressable onPress={w.logout} accessibilityLabel="Log out" style={{ minHeight: 44, justifyContent: "center" }}><Text style={[ui.mono, { color: colors.textDim, fontSize: 11 }]}>{w.address ? `${w.address.slice(0, 4)}…${w.address.slice(-4)}` : "guest"} ⎋</Text></Pressable>
      </View>
      <Banners />
      <View style={{ flex: 1 }}>
        {/* Packs stays mounted so a half-opened pack survives a look at another tab */}
        <View style={{ flex: 1, display: tab === "packs" ? "flex" : "none" }}>
          <Play onProof={(id) => { setProof(String(id)); setTab("proof"); }} onBinder={() => setTab("binder")} />
        </View>
        {tab === "binder" && <Portfolio />}
        {tab === "proof" && <Verify initial={proof} />}
        {tab === "dev" && <Dev />}
      </View>
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderColor: colors.line }}>
        {TABS.map(([k, label]) => (
          <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={{ flex: 1, alignItems: "center", minHeight: 48, justifyContent: "center" }}>
            <Text style={{ color: tab === k ? colors.accent : colors.textDim, fontFamily: tab === k ? font.heavy : font.body, fontSize: 14 }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function Tree() {
  return (
    <WalletProvider>
      <GameHost>
        <Shell />
      </GameHost>
    </WalletProvider>
  );
}

export default function App() {
  const [loaded, fontError] = useFonts({ BricolageGrotesque_500Medium, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold, SpaceMono_400Regular, SpaceMono_700Bold });
  // a font that fails to load falls back to the system face rather than blocking the app
  if (!loaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.ink, justifyContent: "center" }}><ActivityIndicator color={colors.accent} /></View>;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ink }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" />
        {env.privyAppId ? (
          <PrivyProvider appId={env.privyAppId} clientId={env.privyClientId || undefined}>
            <Tree />
          </PrivyProvider>
        ) : (
          <Tree />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
