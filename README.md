# Stock Scratchers

Buy a $1 scratch card with mock USDC and win **tokenized stock**: anything from money back to a 1,000× jackpot. Built for MagicBlock **Solana Blitz v10** (Entertainment Finance). **Devnet only, mock tokens, no real money.**

| Promise | How |
|---|---|
| Fair | MagicBlock VRF sets each card against a public, frozen prize table (`Series`). Anyone can recompute tier and panel art from the on-chain seed (`/verify`). |
| Pays in stock | `shares = multiplier × ticket ÷ locked price`, paid from a stock vault to the player's token account via commit + Magic Action, exactly once. |
| Zero-friction | Gasless plays on a MagicBlock Ephemeral Rollup, signed by a local session key with a program-enforced spend cap. |
| Public odds | 76% RTP; the table is on `/prizes`; `/dashboard` compares actual vs expected payouts. |

## Layout

```
programs/scratchers   Anchor program (Anchor 1.2.2, ephemeral-rollups-sdk 0.18.0)
packages/sdk          shared TS client: routing, instructions, signers, cardArt, sell, status
packages/app-core     shared mock backend + series data for both apps
packages/ui-tokens    palette, tier styles, timings, haptics, glyph paths
apps/web              Next.js + Privy
apps/mobile           Expo (Android / Seeker): Privy + Seeker Connect, Skia scratch
services/keeper       price relay, payout repair, inventory, sell quotes, faucet
scripts               devnet setup (mints, series, vaults, quotes, delegation)
tests/magicsvm        in-process integration tests (both ledgers, VRF, Magic Actions)
```

Architecture and signing model: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Decisions and deviations: [docs/DECISIONS.md](docs/DECISIONS.md). Status and blockers: [docs/PROGRESS.md](docs/PROGRESS.md).

## Trust assumptions (read this)

- **The keeper is the price relay.** Equity prices (TSLA, NVDA) are pushed on-chain by our keeper from Pyth Hermes; the program bounds each update (max move, monotonic time, staleness) but cannot verify the source. Crypto series can switch to MagicBlock's oracle.
- **Sell quotes are keeper-posted** (90 s TTL, 50 bps spread).
- Mock USDC and mock stocks are minted by us on devnet.

## Build and test

```bash
pnpm install
anchor build --arch v0                    # SBF v0 needed for the pinned SDK (see DECISIONS.md)
cargo test -p scratchers                  # unit tests
cd tests/magicsvm && cargo +1.93.0 test   # integration tests (needs Rust 1.93)
pnpm -r typecheck && pnpm --filter @scratchers/sdk test && pnpm --filter @scratchers/keeper test
```

## Run

```bash
# web (mock backend until the devnet deploy)
cp apps/web/.env.example apps/web/.env.local   # add NEXT_PUBLIC_PRIVY_APP_ID
pnpm --filter @scratchers/web dev

# mobile (Android dev build)
cp apps/mobile/.env.example apps/mobile/.env.local  # Privy app id + client id
cd apps/mobile && npx expo run:android

# devnet (needs ~6 devnet SOL in the deployer)
pnpm --filter @scratchers/scripts setup:devnet
```
