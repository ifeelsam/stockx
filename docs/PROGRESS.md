# Progress

**Submission deadline: UNCONFIRMED** — build.magicblock.app landing page is client-rendered and shows no date (checked 2026-11-24). Owner to confirm; update here. Code freeze = deadline − 3h.

## Status (2026-11-24, session 1)

**Done and green**
- Program (`programs/scratchers`, Anchor 1.2.2 + SDK 0.18.0, build with `anchor build --arch v0`): config/series/vault/feed admin; player signup; delegate/undelegate (player, vault, feed); session keys with program-enforced spend cap; `push_price` (Path B); `buy_card` with liability reservation + one scoped VRF request per card; request-id-bound idempotent `vrf_callback`; `cancel_pending`; `deposit_usdc`/`withdraw_usdc`; `sync_inventory`; `claim_all` (commit + Magic Action) → `pay_out` (action + keeper entrypoints) + exactly-once `Payout`; `mark_settled`.
- Tests: 8 Rust unit tests (`cargo test -p scratchers`), 16 MagicSVM integration tests (`cd tests/magicsvm && cargo +1.93.0 test`), 13 SDK tests, 5 keeper tests.
- SDK (`packages/sdk`): generated client, connections + router `getDelegationStatus`, Signer/SessionKeySigner, PDAs, tier/share math, `cardArt`, instruction builders, account decoders + rollup subscriptions.
- Scripts: `pnpm --filter @scratchers/scripts setup:devnet` (idempotent; base half verified on a local validator).
- Keeper (`services/keeper`): price pusher (Hermes/dev, band-safe walk), payout repair, inventory refill, staleness watcher, `/metrics`, faucet. Faucet smoke-tested locally.

**Not started**
- Web app (`apps/web`), mobile app (`apps/mobile`), `packages/ui-tokens`, `packages/animations`, Rive/Lottie assets.
- Program: Path A oracle read, `Stats` account, `sell_to_vault` + SDK `sell()`, commit-limit/fee-vault test, SDK `delegateSpl` wrapper for USDC onboarding.
- Status-page poller + degraded banner (SDK helper).

## Blocked / needs owner
- **Submission deadline** (not visible on build.magicblock.app; needed for the code-freeze time).
- **Devnet SOL for the deployer** (~6 SOL: program deploy ≈ 4 + setup). Airdrop endpoints are rate-limited. Deployer address: `solana address -k ~/.config/stockx/deployer.json`; fund at https://faucet.solana.com. Then: deploy, run setup, start keeper, and verify on devnet: delegation, VRF callbacks, a real Magic Action (dropped-action behaviour), Magic ATA treasury creation.
- **Hermes price access**: `hermes.pyth.network` price endpoints return 401. Need an authenticated Hermes-compatible endpoint/key (`HERMES_AUTH_HEADER`), or approve using the dev random-walk for the demo. Also send `docs/TELEGRAM_DRAFT.md` to MagicBlock (TSLA/NVDA on the rollup oracle).
- **Privy app ID/secret** (web + mobile login), then the mobile Seeker/Privy risk test (Android emulator or device).

## Verification gaps (honest list)
- Nothing has run on devnet yet. MagicSVM models the delegation program, VRF, commits and Magic Actions, but not the router, real VRF oracle, commit limits/fees, or the real committor's drop-the-action behaviour.
- Treasury token account for USDC must be created as a Magic ATA on the rollup (SDK `create_magic_ata_ix`); MagicSVM tests use delegated token accounts instead.
