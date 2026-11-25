# Stock Scratchers

Rip a $1 holo pack with mock USDC and keep the **tokenized stock** inside: from 20¢ of Dust to a 1,000× Grail. Built for MagicBlock **Solana Blitz v10** (Entertainment Finance). **Devnet only, mock tokens, no real money.**

| Promise | How |
|---|---|
| Fair | MagicBlock VRF sets every card against a public, frozen prize table (`Series`). Anyone can recompute the rarity and the panel art from the on-chain seed (`/verify`). |
| Pays in stock | `shares = multiplier_bps × ticket ÷ 10,000 ÷ locked price`, paid from a stock vault to the player's token account via commit + Magic Action, exactly once. Dust is paid too: every rarity holds stock. |
| Zero-friction | Gasless plays on a MagicBlock Ephemeral Rollup, signed by a local session key with a program-enforced spend cap. |
| Public odds | 75.371% RTP with no blank cards; the table is on `/prizes`; `/dashboard` compares actual vs expected payouts. |

## Rarity table (default series)

| Rarity | Payout | Odds | Weight | RTP |
|---|---|---|---|---|
| Dust | 0.2× (20¢ back) | 76.025% | 76,025 | 15.205% |
| Common | 1× | 12.5% | 12,500 | 12.5% |
| Uncommon | 2× | 8.333% | 8,333 | 16.666% |
| Rare | 5× | 2% | 2,000 | 10% |
| Epic | 10× | 1% | 1,000 | 10% |
| Legend | 50× | 0.1% | 100 | 5% |
| Mythic | 100× | 0.04% | 40 | 4% |
| Grail | 1,000× | 0.002% | 2 | 2% |
| **Total** | | | **100,000** | **75.371%** |

Dust is a payout, not a win: greyscale card, no holo, no confetti, no win sound. Celebration starts at Uncommon (2×), where the player is actually ahead. The demo series boosts the Grail to about 1 in 20 and is always labelled **DEMO ODDS**.

## Layout

```
programs/scratchers   Anchor program (Anchor 1.2.2, ephemeral-rollups-sdk 0.18.0)
packages/sdk          shared TS client: routing, instructions, signers, tiers, cardArt, sell, status
packages/app-core     shared mock backend + series data for both apps
packages/ui-tokens    holo palette, rarity styles, timings, haptics, glyph paths
apps/web              Next.js + Privy: holo pack flip, portfolio, prizes, verify, dashboard
apps/mobile           Expo (Android / Seeker): Privy + Seeker Connect, Reanimated flip
services/keeper       price relay, payout repair, inventory, sell quotes, faucet
scripts               devnet setup (mints, series 11–14, vaults, quotes, delegation)
tests/magicsvm        in-process integration tests (both ledgers, VRF, Magic Actions)
```

Architecture and signing model: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Decisions and deviations: [docs/DECISIONS.md](docs/DECISIONS.md). Status and blockers: [docs/PROGRESS.md](docs/PROGRESS.md).

## Trust assumptions (read this)

- **The keeper is the price relay.** Equity prices (TSLA, NVDA) are pushed on-chain by our keeper from Pyth Pro; the program bounds each update (max move, monotonic time, staleness) but cannot verify the source. Crypto series can switch to MagicBlock's oracle.
- **Sell quotes are keeper-posted** (90 s TTL, 50 bps spread).
- Mock USDC and mock stocks are minted by us on devnet.

## Build and test

```bash
pnpm install
anchor build --arch v0                    # SBF v0 needed for the pinned SDK (see DECISIONS.md)
cargo test -p scratchers                  # unit tests (table, RTP, boundaries, size)
cd tests/magicsvm && cargo +1.95.0-sbpf-solana-v1.57 test  # integration tests
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
