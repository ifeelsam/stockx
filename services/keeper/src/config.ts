import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Keypair } from "@solana/web3.js";

export type Deployments = {
  program: string; validator: string;
  mints: Record<string, string>;
  feeds: Record<string, { id: string; pda: string }>;
  series: { id: number; stock: string; demo: boolean; pda: string; vault: string }[];
};

const fromBytes = (json: string) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(json)));
/** Key from an inline JSON secret (container secrets) when set, else from a file. */
const key = (path: string, inlineJson?: string) => (inlineJson ? fromBytes(inlineJson) : fromBytes(readFileSync(path.replace(/^~/, homedir()), "utf8")));

export function loadConfig(env = process.env) {
  const dir = join(homedir(), ".config", "stockx");
  const faucetPath = env.FAUCET_AUTHORITY_KEYPAIR_PATH ?? join(dir, "deployer.json"); // also mint authority
  return {
    port: Number(env.PORT ?? 8787),
    rpcUrl: env.RPC_URL,
    region: (env.REGION as "asia" | "eu" | "us" | undefined) ?? "asia",
    keeper: key(env.KEEPER_KEYPAIR_PATH ?? join(dir, "keeper.json"), env.KEEPER_KEYPAIR_JSON),
    faucet: key(faucetPath, env.FAUCET_AUTHORITY_KEYPAIR_JSON),
    deployments: JSON.parse(readFileSync(env.DEPLOYMENTS ?? join(import.meta.dirname, "../../../deployments/devnet.json"), "utf8")) as Deployments,
    priceSource: (env.PRICE_SOURCE ?? "hermes") as "hermes" | "dev" | "pythpro",
    pythProToken: env.PYTH_PRO_TOKEN,
    pythProUrl: env.PYTH_PRO_URL ?? "https://pyth.dourolabs.app",
    // Pyth Lazer ids (looked up 2026-11-24 via /v1/symbols): Equity.US.TSLA/USD, Equity.US.NVDA/USD, Crypto.SOL/USD
    pythProIds: JSON.parse(env.PYTH_PRO_IDS ?? '{"mTSLA":1435,"mNVDA":1314,"mSOL":6}') as Record<string, number>,
    hermesUrl: env.HERMES_URL ?? "https://hermes.pyth.network",
    hermesAuthHeader: env.HERMES_AUTH_HEADER,
    repairGraceMs: Number(env.REPAIR_GRACE_MS ?? 20_000),
    faucetOrigin: env.FAUCET_ORIGIN ?? "*",
    faucetCooldownMs: Number(env.FAUCET_COOLDOWN_MS ?? 3_600_000),
    refillStock: env.REFILL_STOCK === "1", // devnet mock refill only
  };
}
export type Config = ReturnType<typeof loadConfig>;
