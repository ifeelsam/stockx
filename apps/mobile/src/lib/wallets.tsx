import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { usePrivy, useEmbeddedSolanaWallet } from "@privy-io/expo";
import { SeekerConnect, type WalletAvailability } from "@solana-mobile/seeker-connect-react-native";
import type { Signer } from "@scratchers/sdk";
import { env } from "../env";

export type WalletKind = "privy" | "seeker" | "guest";
type Wallet = {
  kind: WalletKind | null;
  address: string | null;
  signer: Signer | null;
  availability: WalletAvailability | "unknown";
  ready: boolean;
  connectSeeker(): Promise<void>;
  continueAsGuest(): void;
  logout(): Promise<void>;
};
const Ctx = createContext<Wallet | null>(null);
export const useWallet = () => {
  const w = useContext(Ctx);
  if (!w) throw new Error("WalletProvider missing");
  return w;
};

const toBytes = (tx: Transaction | VersionedTransaction) =>
  tx instanceof VersionedTransaction ? tx.serialize() : tx.serialize({ requireAllSignatures: false, verifySignatures: false });
const fromBytes = <T extends Transaction | VersionedTransaction>(like: T, b: Uint8Array): T =>
  (like instanceof VersionedTransaction ? VersionedTransaction.deserialize(b) : Transaction.from(b)) as T;

/** Seeker Connect / MWA: the wallet only signs Solana-layer txs (signup, delegate, deposit, session). Sign only, we send. */
function seekerSigner(address: string): Signer {
  return {
    publicKey: new PublicKey(address),
    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
      const [signed] = await SeekerConnect.signTransactions([toBytes(tx)]);
      return fromBytes(tx, signed);
    },
  };
}

function useSeeker() {
  const [address, setAddress] = useState<string | null>(null);
  const [availability, setAvailability] = useState<WalletAvailability | "unknown">("unknown");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        // identity.uri must be an absolute https URL: the Seeker wallet can end the session for custom schemes
        await SeekerConnect.configure({ identity: { name: "Stock Scratchers", uri: "https://stockscratchers.app", icon: "favicon.ico" }, chain: "solana:devnet" });
        setAvailability(await SeekerConnect.walletAvailability());
        const restored = await SeekerConnect.restore();
        if (restored?.accounts[0]) setAddress(restored.accounts[0].address);
      } catch {
        setAvailability("none");
      } finally {
        setReady(true);
      }
    })();
  }, []);
  const connect = useCallback(async () => {
    const auth = await SeekerConnect.connect();
    setAddress(auth.accounts[0].address);
  }, []);
  const disconnect = useCallback(async () => {
    await SeekerConnect.disconnect().catch(() => {});
    setAddress(null);
  }, []);
  return { address, availability, ready, connect, disconnect };
}

function usePrivySigner(): { address: string | null; signer: Signer | null; ready: boolean; logout: () => Promise<void> } {
  const { user, isReady, logout } = usePrivy();
  const sol = useEmbeddedSolanaWallet();
  useEffect(() => {
    if (user && sol.status === "not-created") sol.create?.().catch(() => {});
  }, [user, sol.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const w = sol.status === "connected" ? sol.wallets?.[0] : undefined;
  const signer = useMemo<Signer | null>(() => {
    if (!w) return null;
    return {
      publicKey: new PublicKey(w.address),
      async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
        const provider = await w.getProvider();
        const { signedTransaction } = await provider.request({ method: "signTransaction", params: { transaction: tx } });
        return signedTransaction as T;
      },
    };
  }, [w]);
  return { address: w?.address ?? null, signer, ready: isReady, logout };
}

function Host({ children, privy }: { children: ReactNode; privy: ReturnType<typeof usePrivySigner> | null }) {
  const seeker = useSeeker();
  const [guest, setGuest] = useState(false);
  const seekerSignerMemo = useMemo(() => (seeker.address ? seekerSigner(seeker.address) : null), [seeker.address]);

  const value = useMemo<Wallet>(() => {
    // Seeker first on a Seeker; otherwise whichever session exists
    const kind: WalletKind | null = seekerSignerMemo ? "seeker" : privy?.signer ? "privy" : guest ? "guest" : null;
    return {
      kind,
      address: kind === "seeker" ? seeker.address : kind === "privy" ? privy!.address : null,
      signer: kind === "seeker" ? seekerSignerMemo : kind === "privy" ? privy!.signer : null,
      availability: seeker.availability,
      ready: seeker.ready && (privy ? privy.ready : true),
      connectSeeker: seeker.connect,
      continueAsGuest: () => setGuest(true),
      logout: async () => {
        setGuest(false);
        await seeker.disconnect();
        await privy?.logout();
      },
    };
  }, [seekerSignerMemo, privy, guest, seeker]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function PrivyHost({ children }: { children: ReactNode }) {
  const p = usePrivySigner();
  return <Host privy={p}>{children}</Host>;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  // env is a build-time constant, so which branch runs never changes between renders
  return env.privyAppId ? <PrivyHost>{children}</PrivyHost> : <Host privy={null}>{children}</Host>;
}
