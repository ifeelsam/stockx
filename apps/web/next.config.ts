import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // workspace packages ship ESM dist; web3.js / anchor pull node builtins that browsers don't need
  transpilePackages: ["@scratchers/sdk", "@scratchers/ui-tokens", "@scratchers/app-core"],
  turbopack: {},
};

export default config;
