import { PublicKey } from "@solana/web3.js";
import idl from "./generated/scratchers.json" with { type: "json" };

export const PROGRAM_ID = new PublicKey(idl.address);
export const SHARE_DECIMALS = 6;
export const USDC_DECIMALS = 6;
export const MAX_CARDS = 32;
export const MAX_BUY = 10;

/** Ephemeral VRF queue (delegated; use from inside the rollup). */
export const VRF_EPHEMERAL_QUEUE = new PublicKey("5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc");
export const VRF_PROGRAM_ID = new PublicKey("Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz");
export const SLOT_HASHES = new PublicKey("SysvarS1otHashes111111111111111111111111111");

export const MAGIC_PROGRAM_ID = new PublicKey("Magic11111111111111111111111111111111111111");
export const MAGIC_CONTEXT_ID = new PublicKey("MagicContext1111111111111111111111111111111");

export type Network = "devnet";

/** Devnet ER validators, verified against the router `getRoutes` on 2026-11-24. */
export const DEVNET_VALIDATORS = {
  asia: { identity: new PublicKey("MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57"), fqdn: "https://devnet-as.magicblock.app/" },
  eu: { identity: new PublicKey("MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e"), fqdn: "https://devnet-eu.magicblock.app/" },
  us: { identity: new PublicKey("MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd"), fqdn: "https://devnet-us.magicblock.app/" },
} as const;

export const ENDPOINTS = {
  devnet: {
    base: "https://rpc.magicblock.app/devnet",
    router: "https://devnet-router.magicblock.app/",
    status: "https://status.magicblock.app/api/services",
  },
} as const;
