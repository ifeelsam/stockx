# Progress

**Submission deadline: owner says not to worry about it (2026-11-24); keep building, no code-freeze planning.**

## 2026-11-26: PLAN.md rarity + holo-pack refactor (current state)

**Done and green**
- **New prize table on chain and in the SDK**: `Tier { multiplier_bps: u32, weight: u32 }` with Dust/Common/Uncommon/Rare/Epic/Legend/Mythic/Grail (2,000 → 10,000,000 bps; weights 76,025 / 12,500 / 8,333 / 2,000 / 1,000 / 100 / 40 / 2). Weight sum 100,000, `Σ weight×bps` 753,710,000 → **75.371% RTP**. `shares_for` divides by 10,000; buy/reserve/reveal/events all carry `multiplier_bps`.
- **Dust pays.** Every rarity produces shares, so `claim_all` batches Dust like any other card. Rust test pins the Plan's $1 @ $412.35 → 485-unit Dust vector; MagicSVM's claim test asserts Common 5,000 + Dust 1,000 are both paid, and that accounting releases 6,000.
- **Checks**: `cargo test -p scratchers` 13/13, MagicSVM 21/21 (`cargo +1.95.0-sbpf-solana-v1.57 test`, after `anchor build --arch v0`), SDK 20/20, ui-tokens 1/1, `pnpm -r typecheck` green (web, mobile, app-core, scripts, keeper).
- **IDL + generated client regenerated** (`scripts/gen-sdk.sh`) for the new `Tier` layout and events.
- **Series 11–14**: setup script and app-core create/expect TSLA 11, NVDA 12, SOL 13, TSLA demo 14. Series 1–4 are unreachable under the new layout (documented in DECISIONS.md). Default UI series = 11, demo = 14.
- **Holo pack replaces scratch**: web `HoloCard` (foil front, tap-to-flip, rarity-scaled FX, no celebration for Dust/Common) and mobile `HoloCard` (Reanimated flip, haptics, CoinBurst from Uncommon up). `ScratchCard` (canvas + Skia) and the scratch threshold token are deleted; `flipped`/`markFlipped` replaces `scratched`/`markScratched` in app-core. `/play`, `/prizes`, `/verify`, `/dashboard` and the mobile Prizes/Verify screens now speak rarities; the landing page hero is a Grail card.
- **Web design**: holo palette (`#0D0B14` ground, `#F2EFFA` card stock, `#9DF3FF` accent), Bricolage Grotesque + Space Mono, foil/sheen/dust CSS, tier badges. UI copy states 75.37% RTP, “every pack holds stock”, and “Dust · 20¢ back, not a win”.

**Live on devnet (2026-11-26):** program upgraded twice (slot 526281244), series 11–14 created, `SERIES=11 e2e:devnet` passes: 10 buys → 10 VRF reveals → `claim_all` in batches of 8 + 2 → shares arrive exactly via Magic Action → `Stats` match → `sell_to_vault`. First run found `claim_all` of 8 cards exceeding the validator intent limit; fixed (DECISIONS.md).

**Open: per-card cost.** Each payout rents a receipt (772,160 lamports) plus a 5,000-lamport action fee, paid from the player's side; at an assumed $150/SOL that is about 12¢ against a 24.6¢ edge on a $1 ticket. VRF on the ephemeral queue is free. Needs receipt rent reclaim or a price change before any mainnet use.

**Still to do before calling the refactor shipped**
- Look over the mobile redesign on a device. Packs, tear-to-rip (PanResponder), swipe-one-by-one flip, Grail modal, Binder and Proof are written to the design in Skia with the design fonts; typecheck and the Android bundle build, and the login screen renders on the emulator, but the screens behind login have **not** been visually checked. (Web is done and was checked in a headless browser on the mock backend at 1440 and 390 wide.)
- Privy dashboard: add `app.stockscratchers` as an allowed app identifier (the emulator's Google login says it is missing).
- Restart the keeper so payout repair knows series 11–14.
- Device pass on the mobile holo flip (Seeker/emulator) and a browser pass of web `/play` (both currently typecheck only).
- Update ARCHITECTURE.md if any diagram still says “scratch”.

## Devnet verification (2026-11-24, pre-refactor)


**Live and verified on devnet** (program `EQaiygf…`, rollup devnet-as): `pnpm --filter @scratchers/scripts e2e:devnet` passes end to end: signup → delegate Player → eSPL `delegateSpl` of 50 mUSDC → Magic-ATA treasury → `create_session` → `deposit_usdc` → `buy_card ×10` signed only by the session key → 10 VRF reveals (arrive in about a second) → every tier recomputes from its seed → `claim_all` (commit + Magic Action) → shares land on Solana exactly (92,939 units expected = received) with no keeper repair needed. The same script then reads `Stats` back from the rollup (counters match) and sells the shares to the vault via `sell_to_vault` at the keeper-posted quote (both verified).

Bugs only devnet could find (all fixed): treasury shared an address with the base-layer sell pool, so the rollup held a read-only clone (`deposit_usdc` → "Account is immutable"); `setup:devnet` re-synced inventory on every run (it read the delegated vault from the base layer), double-counting the mirror; `fetchPlayer` connection override. Public RPC rate limits (429) make `setup` slow but it is idempotent.

Keeper now relays real Pyth Pro prices (TSLA, SOL) to the rollup and posts sell quotes. Still unverified: dropped-Magic-Action repair path, commit-limit/fee-vault behaviour, Privy login, Seeker/MWA signing, the chain-backend UI in a browser/phone.

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

- Chain backend written (`ChainGameProvider`: onboarding, buy via session key, claim, faucet, sell, stats/price polling) and wired into web behind `NEXT_PUBLIC_BACKEND=chain` + Privy login. Typechecks; **unverified on devnet**. Mobile is wired the same way (`GameHost`: Privy or Seeker signer + SecureStore session key + deployments from the keeper's new `/deployments`), also unverified on devnet.

**Not started**
- Web app on the chain backend (mock backend done), mobile app (`apps/mobile`), `packages/animations`, Rive asset.
- Program: Path A oracle read, `Stats` account, commit-limit/fee-vault test, SDK `delegateSpl` wrapper for USDC onboarding.
- Status-page poller + degraded banner (SDK helper).

## Blocked / needs owner
- **Devnet SOL for the deployer** (~6 SOL: program deploy ≈ 4 + setup). Airdrop endpoints are rate-limited. Deployer address: `solana address -k ~/.config/stockx/deployer.json`; fund at https://faucet.solana.com. Then: deploy, run setup, start keeper, and verify on devnet: delegation, VRF callbacks, a real Magic Action (dropped-action behaviour), Magic ATA treasury creation.
- **NVDA price**: the Pyth Pro token works for TSLA and SOL but is not entitled to NVDA (feed 1314). Ask Pyth to extend the grant, or the mNVDA series stays paused.
- ~~Hermes price access~~ resolved via Pyth Pro (see DECISIONS). Old note: **Hermes price access**: `hermes.pyth.network` price endpoints return 401. Need an authenticated Hermes-compatible endpoint/key (`HERMES_AUTH_HEADER`), or approve using the dev random-walk for the demo. Also send `docs/TELEGRAM_DRAFT.md` to MagicBlock (TSLA/NVDA on the rollup oracle).
- ~~Privy app ID~~ received (web `.env.local`, mobile `.env.local`). **Mobile also needs a Privy *client ID*** (Privy dashboard → Clients → new client for Expo; add Android package `app.stockscratchers` and scheme `stockscratchers`) in `EXPO_PUBLIC_PRIVY_CLIENT_ID`. Also still need: Android emulator/device for the mobile Seeker/Privy risk test. Privy login itself is untested in a real browser session (needs an interactive login; allowed origins must include localhost / the deploy URL in the Privy dashboard).

## Verification gaps (honest list)
- Nothing has run on devnet yet. MagicSVM models the delegation program, VRF, commits and Magic Actions, but not the router, real VRF oracle, commit limits/fees, or the real committor's drop-the-action behaviour.
- Treasury token account for USDC must be created as a Magic ATA on the rollup (SDK `create_magic_ata_ix`); MagicSVM tests use delegated token accounts instead.
