import { useState } from "react";
import { Pressable, StatusBar, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { PrivyProvider } from "@privy-io/expo";
import { GameProvider, useGame } from "@scratchers/app-core";
import { colors } from "@scratchers/ui-tokens";
import { env } from "./src/env";
import { WalletProvider, useWallet } from "./src/lib/wallets";
import { Banners } from "./src/components/Banners";
import { Login } from "./src/screens/Login";
import { Play } from "./src/screens/Play";
import { Portfolio } from "./src/screens/Portfolio";
import { Prizes } from "./src/screens/Prizes";
import { Verify } from "./src/screens/Verify";
import { Dev } from "./src/screens/Dev";

const TABS = [["play", "Play", Play], ["portfolio", "Portfolio", Portfolio], ["prizes", "Prizes", Prizes], ["verify", "Verify", Verify], ["dev", "Dev", Dev]] as const;

function Shell() {
  const w = useWallet();
  const g = useGame();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("play");
  if (!w.kind) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }}><Login /></SafeAreaView>;
  const Screen = TABS.find((t) => t[0] === tab)![2];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.line }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}><Text style={{ color: colors.gold }}>Stock</Text> Scratchers</Text>
        <Text style={{ color: colors.money, marginLeft: "auto", fontVariant: ["tabular-nums"] }}>${g.usdc.toFixed(2)}</Text>
        <Pressable onPress={w.logout} style={{ marginLeft: 12 }}><Text style={{ color: colors.textDim, fontSize: 12 }}>{w.address ? `${w.address.slice(0, 4)}…${w.address.slice(-4)}` : "guest"} ⎋</Text></Pressable>
      </View>
      <Banners />
      <View style={{ flex: 1 }}><Screen /></View>
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
        {TABS.map(([k, label]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, alignItems: "center", paddingVertical: 12 }}>
            <Text style={{ color: tab === k ? colors.money : colors.textDim, fontWeight: tab === k ? "800" : "500", fontSize: 12 }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function Tree() {
  return (
    <WalletProvider>
      <GameProvider>
        <Shell />
      </GameProvider>
    </WalletProvider>
  );
}

export default function App() {
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
