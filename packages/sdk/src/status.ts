/** MagicBlock service status (https://status.magicblock.app/api/services) → "what is degraded for us". */
export type ServiceId = "er" | "rpc_router" | "pricing_oracle" | "vrf_oracle";
export type StatusRegion = "asia" | "europe" | "usa" | "tee";

/** Services a play needs. `pricing_oracle` is deliberately absent: prices come from our own feed (Path B). */
export const REQUIRED_SERVICES: { id: ServiceId; label: string }[] = [
  { id: "er", label: "Ephemeral Rollup" },
  { id: "rpc_router", label: "RPC router" },
  { id: "vrf_oracle", label: "VRF randomness" },
];

type StatusJson = {
  environments?: Record<string, { regions?: Record<string, { servers?: Record<string, { live_status?: Partial<Record<ServiceId, boolean>> }> }> }>;
};

/** Labels of required services reported `false` (Down) in this region. Missing/undefined = N/A, not degraded. */
export function degradedServices(json: StatusJson, network: "devnet" | "mainnet", region: StatusRegion): string[] {
  const servers = Object.values(json.environments?.[network]?.regions?.[region]?.servers ?? {});
  return REQUIRED_SERVICES.filter(({ id }) => servers.some((s) => s.live_status?.[id] === false)).map((s) => s.label);
}

export async function fetchDegraded(network: "devnet" | "mainnet" = "devnet", region: StatusRegion = "asia", fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const r = await fetchImpl("https://status.magicblock.app/api/services");
  if (!r.ok) throw new Error(`status API ${r.status}`);
  return degradedServices((await r.json()) as StatusJson, network, region);
}
