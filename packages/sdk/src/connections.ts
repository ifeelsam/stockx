import { Connection, PublicKey } from "@solana/web3.js";
import { DEVNET_VALIDATORS, ENDPOINTS, type Network } from "./constants.js";

export type ValidatorRegion = keyof typeof DEVNET_VALIDATORS;

export interface Connections {
  base: Connection;
  /** Rollup for `region` (accounts delegated to that validator). */
  rollup: Connection;
  validator: PublicKey;
  routerUrl: string;
}

/** Base layer for init/delegate/deposit, rollup for everything on delegated accounts. */
export function connect(opts: { network?: Network; region?: ValidatorRegion; baseUrl?: string; rollupUrl?: string } = {}): Connections {
  const net = opts.network ?? "devnet";
  const v = DEVNET_VALIDATORS[opts.region ?? "asia"];
  return {
    base: new Connection(opts.baseUrl ?? ENDPOINTS[net].base, "confirmed"),
    rollup: new Connection(opts.rollupUrl ?? v.fqdn, { commitment: "confirmed", wsEndpoint: (opts.rollupUrl ?? v.fqdn).replace(/^http/, "ws") }),
    validator: v.identity,
    routerUrl: ENDPOINTS[net].router,
  };
}

export type DelegationStatus = {
  isDelegated: boolean;
  fqdn?: string;
  delegationRecord?: { authority: string; owner: string; delegationSlot: number; lamports: number };
};

export async function getDelegationStatus(account: PublicKey, routerUrl: string = ENDPOINTS.devnet.router): Promise<DelegationStatus> {
  const res = await fetch(routerUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getDelegationStatus", params: [account.toBase58()] }),
  });
  const body = (await res.json()) as { result?: DelegationStatus; error?: { message: string } };
  if (body.error) throw new Error(body.error.message);
  return body.result!;
}

/** Pick the connection a delegated/undelegated account must be written through. */
export async function connectionFor(c: Connections, account: PublicKey): Promise<Connection> {
  const s = await getDelegationStatus(account, c.routerUrl);
  if (!s.isDelegated) return c.base;
  return s.fqdn && s.fqdn !== c.rollup.rpcEndpoint ? new Connection(s.fqdn, "confirmed") : c.rollup;
}
