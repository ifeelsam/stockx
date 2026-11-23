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

const key = (path: string) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path.replace(/^~/, homedir()), "utf8"))));

export function loadConfig(env = process.env) {
  const dir = join(homedir(), ".config", "stockx");
  const faucetPath = env.FAUCET_AUTHORITY_KEYPAIR_PATH ?? join(dir, "deployer.json"); // also mint authority
  return {
    port: Number(env.PORT ?? 8787),
    rpcUrl: env.RPC_URL,
    region: (env.REGION as "asia" | "eu" | "us" | undefined) ?? "asia",
    keeper: key(env.KEEPER_KEYPAIR_PATH ?? join(dir, "keeper.json")),
    faucet: key(faucetPath),
    deployments: JSON.parse(readFileSync(env.DEPLOYMENTS ?? join(import.meta.dirname, "../../../deployments/devnet.json"), "utf8")) as Deployments,
    priceSource: (env.PRICE_SOURCE ?? "hermes") as "hermes" | "dev",
    hermesUrl: env.HERMES_URL ?? "https://hermes.pyth.network",
    hermesAuthHeader: env.HERMES_AUTH_HEADER,
    repairGraceMs: Number(env.REPAIR_GRACE_MS ?? 20_000),
    faucetOrigin: env.FAUCET_ORIGIN ?? "*",
    faucetCooldownMs: Number(env.FAUCET_COOLDOWN_MS ?? 3_600_000),
    refillStock: env.REFILL_STOCK === "1", // devnet mock refill only
  };
}
export type Config = ReturnType<typeof loadConfig>;
