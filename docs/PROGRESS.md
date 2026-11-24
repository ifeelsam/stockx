# Progress

**Submission deadline: owner says not to worry about it (2026-11-24); keep building, no code-freeze planning.**

## Status (2026-11-24, session 1)

**Done and green**
- Program (`programs/scratchers`, Anchor 1.2.2 + SDK 0.18.0, build with `anchor build --arch v0`): config/series/vault/feed admin; player signup; delegate/undelegate (player, vault, feed); session keys with program-enforced spend cap; `push_price` (Path B); `buy_card` with liability reservation + one scoped VRF request per card; request-id-bound idempotent `vrf_callback`; `cancel_pending`; `deposit_usdc`/`withdraw_usdc`; `sync_inventory`; `claim_all` (commit + Magic Action) → `pay_out` (action + keeper entrypoints) + exactly-once `Payout`; `mark_settled`.
- Tests: 8 Rust unit tests (`cargo test -p scratchers`), 16 MagicSVM integration tests (`cd tests/magicsvm && cargo +1.93.0 test`), 13 SDK tests, 5 keeper tests.
- SDK (`packages/sdk`): generated client, connections + router `getDelegationStatus`, Signer/SessionKeySigner, PDAs, tier/share math, `cardArt`, instruction builders, account decoders + rollup subscriptions.
- Scripts: `pnpm --filter @scratchers/scripts setup:devnet` (idempotent; base half verified on a local validator).
- Keeper (`services/keeper`): price pusher (Hermes/dev, band-safe walk), payout repair, inventory refill, staleness watcher, `/metrics`, faucet. Faucet smoke-tested locally.

- Mobile (`apps/mobile`, Expo SDK 58 dev-client, Android): Login (Seeker Connect + Privy email/Google + demo guest), Play (Skia scratch, haptics, Reanimated fan-out/burst/jackpot), Portfolio (wagmi-charts), Prizes, Verify, Dev risk-test screen. Typechecks and bundles (`expo export`, 3813 modules incl. full SDK + anchor + Privy). **Native build verified** (Gradle debug build, arm64, `stockx_test` AVD): app boots, demo flow works (buy 10 → Skia scratch → 60% auto-reveal → count-up), Seeker Connect native button launches its flow (reports "no wallet" on an emulator without an MWA wallet), and the Dev screen's session key (SecureStore) signed a tx that **landed on the live devnet-as rollup**. Still untested: Privy login (needs client id), real Seeker/MWA signing (needs a mock MWA wallet app or a device).
- Web (`apps/web`, Next 16 + Privy + Tailwind 4): landing, /play (series picker, buy 1/10, pack fan-out, canvas scratch, claim all, jackpot overlay), /portfolio (live lightweight-charts, P/L, sell), /prizes, /verify, /dashboard, status banners. Runs on a **mock backend** (in-browser simulation); typechecks, builds, and a headless-Chromium run of buy 10 → scratch → claim → portfolio passes. `packages/ui-tokens` shared tokens.

- Sell path: `sell_to_vault` / `set_sell_quote` / `ack_sold` + `SellQuote`; SDK `sell()` (devnet vault + Payments API behind a mainnet-only flag); keeper quote poster + inventory credit; setup script inits quotes and a 1M mUSDC sell pool. 20 MagicSVM tests; live-verified on a local validator (real SDK tx → 149.25 mUSDC for 1 share @ $150).

- `scripts/src/e2e.ts` (`pnpm --filter @scratchers/scripts e2e:devnet`): fresh user → signup → delegate → USDC via eSPL `delegateSpl` → Magic-ATA treasury → session key → buy 10 → 10 VRF reveals (tiers recomputed from seeds) → `claim_all` → shares on Solana. Typechecks; **never run** (needs the funded deployer + `setup:devnet`). First thing to run once the deployer has SOL.

- Chain backend written (`ChainGameProvider`: onboarding, buy via session key, claim, faucet, sell, stats/price polling) and wired into web behind `NEXT_PUBLIC_BACKEND=chain` + Privy login. Typechecks; **unverified on devnet**. Mobile wiring (Privy/Seeker signer + SecureStore session key → `ChainGameProvider`) not done yet.

**Not started**
- Web app on the chain backend (mock backend done), mobile app (`apps/mobile`), `packages/animations`, Rive asset.
- Program: Path A oracle read, `Stats` account, commit-limit/fee-vault test, SDK `delegateSpl` wrapper for USDC onboarding.
- Status-page poller + degraded banner (SDK helper).

## Blocked / needs owner
- **Devnet SOL for the deployer** (~6 SOL: program deploy ≈ 4 + setup). Airdrop endpoints are rate-limited. Deployer address: `solana address -k ~/.config/stockx/deployer.json`; fund at https://faucet.solana.com. Then: deploy, run setup, start keeper, and verify on devnet: delegation, VRF callbacks, a real Magic Action (dropped-action behaviour), Magic ATA treasury creation.
- **Hermes price access**: `hermes.pyth.network` price endpoints return 401. Need an authenticated Hermes-compatible endpoint/key (`HERMES_AUTH_HEADER`), or approve using the dev random-walk for the demo. Also send `docs/TELEGRAM_DRAFT.md` to MagicBlock (TSLA/NVDA on the rollup oracle).
- ~~Privy app ID~~ received (web `.env.local`, mobile `.env.local`). **Mobile also needs a Privy *client ID*** (Privy dashboard → Clients → new client for Expo; add Android package `app.stockscratchers` and scheme `stockscratchers`) in `EXPO_PUBLIC_PRIVY_CLIENT_ID`. Also still need: Android emulator/device for the mobile Seeker/Privy risk test. Privy login itself is untested in a real browser session (needs an interactive login; allowed origins must include localhost / the deploy URL in the Privy dashboard).

## Verification gaps (honest list)
- Nothing has run on devnet yet. MagicSVM models the delegation program, VRF, commits and Magic Actions, but not the router, real VRF oracle, commit limits/fees, or the real committor's drop-the-action behaviour.
- Treasury token account for USDC must be created as a Magic ATA on the rollup (SDK `create_magic_ata_ix`); MagicSVM tests use delegated token accounts instead.
