import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { explorerUrl, shortAddress, timeLeft, useGame } from "@scratchers/app-core";
import { colors, money } from "@scratchers/ui-tokens";
import { font, ui } from "../theme";
import { useWallet } from "../lib/wallets";

const KIND = { privy: "Your account", seeker: "Seeker wallet", guest: "Demo (guest)" } as const;

function Row({ k, v, tint }: { k: string; v: string; tint?: string }) {
  return (
    <View style={[ui.row, { justifyContent: "space-between", gap: 12, minHeight: 30 }]}>
      <Text style={ui.dim}>{k}</Text>
      <Text style={[ui.mono, tint ? { color: tint } : null]}>{v}</Text>
    </View>
  );
}

function Button({ label, onPress, disabled, tint }: { label: string; onPress: () => void; disabled?: boolean; tint?: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[ui.btn, ui.ghost, { minHeight: 46, flexGrow: 1, paddingHorizontal: 10, opacity: disabled ? 0.4 : 1 }, tint ? { borderColor: tint } : null]}>
      <Text style={[ui.ghostText, { fontSize: 14 }, tint ? { color: tint } : null]}>{label}</Text>
    </Pressable>
  );
}

/** Header account button and its dropdown. Tapping outside or the back button closes it. */
export function ProfileMenu() {
  const w = useWallet();
  const g = useGame();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const a = g.account;
  const address = w.address;
  const pending = g.cards.filter((c) => c.state === "claiming").length;
  const run = async (f: () => Promise<unknown>) => {
    setErr(null);
    setBusy(true);
    try {
      await f();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const close = () => { setOpen(false); setCopied(false); setErr(null); };
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Your account" style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={[ui.mono, { color: colors.textDim, fontSize: 11 }]}>{address ? shortAddress(address) : "guest"} ▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
        <Pressable onPress={close} accessibilityLabel="Close account menu" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)" }} />
        <View style={[ui.card, { position: "absolute", top: 96, right: 14, width: 318, maxHeight: "80%", padding: 0 }]}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            <View style={[ui.row, { justifyContent: "space-between", gap: 8 }]}>
              <Text numberOfLines={1} style={[ui.strong, { flexShrink: 1, fontFamily: font.heavy, fontSize: 16 }]}>{w.label ?? KIND[w.kind ?? "guest"]}</Text>
              <Text style={[ui.mono, { color: colors.warn, fontSize: 10, borderWidth: 1, borderColor: colors.warn, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }]}>DEVNET</Text>
            </View>
            {address && (
              <>
                <Text selectable style={[ui.mono, { color: colors.textDim, fontSize: 10 }]}>{address}</Text>
                <View style={[ui.row, { gap: 8 }]}>
                  <Button label={copied ? "Copied ✓" : "Copy address"} onPress={() => run(async () => { await Clipboard.setStringAsync(address); setCopied(true); })} />
                  <Button label="Explorer ↗" onPress={() => run(() => Linking.openURL(explorerUrl(address)))} />
                </View>
              </>
            )}
            <View style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 8 }}>
              <Row k="Play balance" v={money(g.usdc)} />
              {a && <Row k="SOL for fees" v={a.sol.toFixed(3)} />}
              {g.holdings.map((h) => <Row key={h.ticker} k={h.ticker} v={`${h.shares.toFixed(4)} · ${money(h.shares * g.prices[h.feed])}`} />)}
              {pending > 0 && <Row k="Payouts pending" v={String(pending)} tint={colors.warn} />}
            </View>
            {a && (
              <View style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 10, gap: 6 }}>
                <Text style={ui.strong}>Play session</Text>
                <Text style={[ui.mono, { color: colors.textDim, fontSize: 11 }]}>{a.session ? `${timeLeft(a.session.expires)} left · ${money(a.session.capUsd)} spend limit` : "Not active on this device"}</Text>
                {a.session && <Button label={busy ? "Working…" : "End session"} disabled={busy} onPress={() => run(a.endSession)} />}
              </View>
            )}
            {err && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{err}</Text>}
            <View style={ui.row}>
              <Button label={w.kind === "guest" ? "Exit demo" : "Log out"} tint={colors.danger} onPress={() => run(async () => { await w.logout(); close(); })} />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
