export const env = {
  privyAppId: process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? "",
  privyClientId: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? "",
  backend: (process.env.EXPO_PUBLIC_BACKEND ?? "mock") as "mock" | "chain",
  baseRpc: process.env.EXPO_PUBLIC_BASE_RPC ?? "https://rpc.magicblock.app/devnet",
  keeperUrl: process.env.EXPO_PUBLIC_KEEPER_URL ?? "http://10.0.2.2:8787",
};
