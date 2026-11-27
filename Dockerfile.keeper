# Build from the repo root:  docker build -f services/keeper/Dockerfile -t scratchers-keeper .
FROM node:22-slim
RUN corepack enable
WORKDIR /repo
# Whole workspace: a frozen lockfile needs every importer's package.json present.
COPY . .
RUN pnpm install --frozen-lockfile --filter @scratchers/keeper...
RUN pnpm --filter @scratchers/sdk build
ENV PORT=8787 DEPLOYMENTS=/repo/deployments/devnet.json
EXPOSE 8787
# Secrets via env (never baked in): KEEPER_KEYPAIR_JSON, FAUCET_AUTHORITY_KEYPAIR_JSON, PYTH_PRO_TOKEN
CMD ["pnpm", "--filter", "@scratchers/keeper", "start"]
