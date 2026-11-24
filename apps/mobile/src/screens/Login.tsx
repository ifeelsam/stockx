import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useLoginWithEmail, useLoginWithOAuth } from "@privy-io/expo";
import { SeekerConnectButton } from "@solana-mobile/seeker-connect-react-native";
import { colors } from "@scratchers/ui-tokens";
import { env } from "../env";
import { ui } from "../theme";
import { useWallet } from "../lib/wallets";

function PrivyLogin() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const emailFlow = useLoginWithEmail();
  const oauth = useLoginWithOAuth();
  const sent = emailFlow.state.status === "awaiting-code-input" || emailFlow.state.status === "submitting-code";
  const run = async (f: () => Promise<unknown>) => { setErr(null); try { await f(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } };
  return (
    <View style={{ gap: 10 }}>
      <TextInput value={email} onChangeText={setEmail} placeholder="email" placeholderTextColor={colors.textDim} autoCapitalize="none" keyboardType="email-address"
        style={{ color: colors.text, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 12 }} />
      {sent ? (
        <>
          <TextInput value={code} onChangeText={setCode} placeholder="6-digit code" placeholderTextColor={colors.textDim} keyboardType="number-pad"
            style={{ color: colors.text, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 12 }} />
          <Pressable style={[ui.btn, { backgroundColor: colors.money }]} onPress={() => run(() => emailFlow.loginWithCode({ code, email }))}><Text style={ui.btnText}>Verify code</Text></Pressable>
        </>
      ) : (
        <Pressable style={[ui.btn, { backgroundColor: colors.money }]} onPress={() => run(() => emailFlow.sendCode({ email }))}><Text style={ui.btnText}>Email me a code</Text></Pressable>
      )}
      <Pressable style={[ui.btn, { borderColor: colors.line, borderWidth: 1 }]} onPress={() => run(() => oauth.login({ provider: "google" }))}><Text style={[ui.btnText, { color: colors.text }]}>Continue with Google</Text></Pressable>
      {err && <Text style={{ color: colors.danger }}>{err}</Text>}
    </View>
  );
}

export function Login() {
  const w = useWallet();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const seekerFirst = w.availability === "certified";
  const seeker = (
    <View>
      <SeekerConnectButton
        style={{ height: 56, width: "100%" }}
        theme="dark"
        onPress={async () => { setErr(null); setBusy(true); try { await w.connectSeeker(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } }}
      />
      {w.availability === "none" && <Text style={[ui.dim, { marginTop: 4, fontSize: 12 }]}>No Solana wallet app found on this device.</Text>}
    </View>
  );
  return (
    <View style={[ui.screen, ui.pad, { justifyContent: "center", gap: 18 }]}>
      <View>
        <Text style={{ color: colors.gold, fontWeight: "700", letterSpacing: 2, fontSize: 12 }}>ENTERTAINMENT × FINANCE</Text>
        <Text style={[ui.h1, { fontSize: 38, lineHeight: 42 }]}>Scratch a $1 card.{"\n"}<Text style={{ color: colors.money }}>Win real stock.</Text></Text>
      </View>
      {!w.ready ? <ActivityIndicator color={colors.money} /> : (
        <>
          {seekerFirst && seeker}
          {env.privyAppId ? <PrivyLogin /> : <Text style={{ color: colors.warn }}>Privy app id not set</Text>}
          {!seekerFirst && seeker}
          {busy && <ActivityIndicator color={colors.money} />}
          {err && <Text style={{ color: colors.danger }}>{err}</Text>}
          <Pressable onPress={w.continueAsGuest}><Text style={[ui.dim, { textAlign: "center", textDecorationLine: "underline" }]}>Try the demo without logging in</Text></Pressable>
        </>
      )}
    </View>
  );
}
