# Build Prompt: Stockx (MagicBlock Solana Blitz v10)

> Paste this whole file into your coding agent as the opening instruction, or save it at the repo root as `CLAUDE.md` / `AGENTS.md` so every session loads it.

---

## 0. Your role

You are the lead engineer building **Stock Scratchers** end to end, solo with me, for MagicBlock's **Solana Blitz v10** hackathon. The theme is *Entertainment Finance* (zero-fee transactions, VRF, privacy). The build covers the full scope below: nothing is cut.

You own the Anchor program, the shared TypeScript SDK, the Next.js web app, the Expo Android app for the **Solana Seeker** phone, and the keeper service. Work in the order in §12, keep the build green, and follow the git rules in §13 exactly.

### Operating rules (read before writing code)

1. **Do not invent APIs.** MagicBlock, Privy, Seeker Connect / Mobile Wallet Adapter, Pyth and Expo change often. Before using an SDK function, macro or endpoint, check the installed package source (`node_modules`, `~/.cargo/registry`) or the official docs or examples. If something in this prompt conflicts with what the real SDK does, the real SDK wins: write the difference down in `docs/DECISIONS.md` and carry on.
2. **Pin versions** as specified, and commit lockfiles.
3. **Keep a log.** Update `docs/PROGRESS.md` (what works, what's next, what's blocked) at each milestone, and `docs/DECISIONS.md` (decision, reason, date) whenever you choose between options.
4. **Ask me only when blocked** on something that only I can provide (API keys, Apple/Google accounts, a decision that's expensive to reverse). Otherwise take the most reasonable path and record it in DECISIONS.md.
5. **Never put secrets in code or git.** Use `.env.local` / `.env` files, which are gitignored, and commit a matching `.env.example`.
6. **Devnet only.** No mainnet deploys, and no real tokenized stocks.

---

## 1. Product

**One line:** Rip a pack of holo cards with USDC, flip them, and keep the **tokenized stock** inside: from 20¢ of Dust up to a 1,000× Grail.

| Promise | Mechanism |
|---|---|
| VRF sets every card's rarity against a public prize table | A `Series` account holds the rarity table and is frozen once live. MagicBlock VRF callback seed → `u64 from seed[0..8] mod total_weight` → rarity band. Anyone can recompute it. |
| Every card holds real stock | `shares = multiplier_bps × ticket_usd ÷ 10,000 ÷ locked_price`, paid from a stock vault to the player's stock token account on Solana. Even Dust pays a little. |
| Winnings move with the market | The payout is shares, not USDC. The binder streams live prices. |
| Flipping is cosmetic | The card art and panels come deterministically from the seed (`cardArt(seed)`), and the proof page recomputes them. |

### Prize table (default series)

Stored on chain as integer weights out of **100,000** and multipliers in **basis points** (1× = 10,000 bps), so 0.2× is exact. Cards are rarities, not win/lose: there is no blank.

| Rarity | Multiplier | `multiplier_bps` | Odds | Weight /100,000 | Roll band (`seed mod 100,000`) | Average payout per $1 card |
|---|---|---|---|---|---|---|
| Dust | 0.2× | 2,000 | ~76.0% | 76,025 | 0 – 76,024 | $0.15205 |
| Common | 1× | 10,000 | 1 in 8 | 12,500 | 76,025 – 88,524 | $0.12500 |
| Uncommon | 2× | 20,000 | 1 in 12 | 8,333 | 88,525 – 96,857 | $0.16666 |
| Rare | 5× | 50,000 | 1 in 50 | 2,000 | 96,858 – 98,857 | $0.10000 |
| Epic | 10× | 100,000 | 1 in 100 | 1,000 | 98,858 – 99,857 | $0.10000 |
| Legend | 50× | 500,000 | 1 in 1,000 | 100 | 99,858 – 99,957 | $0.05000 |
| Mythic | 100× | 1,000,000 | 1 in 2,500 | 40 | 99,958 – 99,997 | $0.04000 |
| Grail | 1,000× | 10,000,000 | 1 in 50,000 | 2 | 99,998 – 99,999 | $0.02000 |
| **Total** | | | | **100,000** | | **$0.75371** |

**The math:** expected payout = Σ(weight × multiplier) ÷ 100,000 = 75,371 ÷ 100,000 = **75.371% returned to players, a 24.629% house edge**. That edge has to cover VRF fees (one per card, not refunded on timeout), commit and Magic Action costs, swap fees and slippage, and stock price moves between the draw and the claim. Check the VRF fee per card against the ~24.6¢ edge on a $1 ticket before setting the ticket price. Payouts are lumpy: a single Grail pays 1,000×, which is why every buy reserves worst-case liability (§4).

**Unit tests:**

- weights sum to `total_weight` (100,000)
- Σ(weight × multiplier_bps) = 753,710,000, i.e. RTP = 75.371% exactly
- each band boundary in the table maps to the right rarity (e.g. 76,024 → Dust, 76,025 → Common, 99,997 → Mythic, 99,998 → Grail)
- `multiplier_bps` for Dust is 2,000, and a Dust payout on a $1 ticket at $412.35 is 0.000485 shares

**Dust is never presented as a win.** It returns 20¢ of a $1 ticket, so the player is down 80¢. Show it plainly ("Dust · 20¢ back in TSLA"), greyscale art, no holo, no confetti, no win sound, no "You won". Common (1×) gets a quiet "money back" treatment. Celebration starts at Uncommon (2×), where the player actually comes out ahead. Face-down Dust cards do not glow; a glow always means a real pull.

### Series to create on devnet

1. **Equity series:** mTSLA and mNVDA cards, $1 ticket, default table. Sales pause when the price is stale (closed market).
2. **Always-on series:** a crypto-priced card (for example mSOL priced on SOL/USD), so the app is never fully paused when US markets are closed (US hours are about 20:00–02:30 IST).
3. **Demo series:** boosted odds (a Grail roughly every 20 cards) so the 1,000× Grail animation can be shown on camera. Clearly labelled "DEMO ODDS" in the UI.

---

## 2. Price oracle (decided: read carefully)

**Facts already checked:** MagicBlock's ER oracle feed list (`pyth_lazer_list.json` in `magicblock-labs/real-time-pricing-oracle`) has 125 entries, **all crypto**, with no TSLA or NVDA. Equities aren't pushed by default.

Build behind one interface so either source can be swapped in:

```rust
// programs/scratchers/src/price.rs
pub enum PriceSource { MagicBlockOracle, SelfPushed }
pub struct ValidatedPrice { pub price: u64 /* 1e8 fixed point USD */, pub publish_ts: i64 }
pub fn read_price(series: &Series, feed_ai: &AccountInfo, clock: &Clock) -> Result<ValidatedPrice>
```

- **Path A, MagicBlock oracle (crypto feeds, and equities if MagicBlock agrees to push them on devnet):**
  - Read on the **rollup only**.
  - Check that the feed account address equals `series.feed` and the owner is the oracle program (`PriCems…`; get the full ID from the repo).
  - Decode with `try_deserialize_unchecked`.
  - Take the exponent from the feed list (stored per series), **not** from the account (the stored exponent is always +8).
  - `conf` is always 0, so enforce a price band: reject an update that moves more than `series.max_move_bps` from `series.last_price`.
- **Path B, self-pushed (equities fallback, default until MagicBlock confirms Path A):**
  - A `PriceFeed` account owned by **our program** and delegated to the rollup. Fields: `feed_id [u8;32]`, `price i64`, `conf u64`, `expo i32`, `publish_ts i64`, `pusher Pubkey`, `bump`.
  - The `push_price` instruction runs on the rollup (gasless) and only `feed.pusher` may sign it. It rejects non-increasing `publish_ts` and moves larger than `max_move_bps`.
  - The keeper polls Pyth **Hermes** (`https://hermes.pyth.network`, Equity.US TSLA/USD and NVDA/USD feed IDs, looked up from Pyth's feed list) about every 400 ms during market hours and pushes.
  - Validation checks the owner is our program, `conf/price` is under `series.max_conf_bps`, freshness, and the band.
  - Disclose in the README that the keeper is the price relay (it's a trust assumption).
- **Both paths:** freshness is `clock.unix_timestamp - publish_ts <= series.max_staleness_s`. If stale, `buy_card` fails with `PriceStale` and the UI shows "Market closed / price paused". The buyer passes `max_price`, and the buy fails if `price > max_price`.

---

## 3. Architecture

```
SOLANA (base layer)                         EPHEMERAL ROLLUP (MagicBlock)
───────────────────                         ─────────────────────────────
Config (admin, keeper, pause)               Player (delegated, < 10 KB)
Series (frozen prize table)                   ├─ 32 card slots
StockVault token accounts (per stock mint)    ├─ USDC balance (eSPL)
Player stock ATAs (created at signup)         └─ session key + spend cap
Payout receipt PDAs (exactly-once)          VaultState (delegated): USDC in, reserved
Stats                                         liability, mirrored available inventory
      ▲                                     PriceFeed (self-pushed, delegated) / MB oracle
      │ Magic Action: pay shares            VRF request → callback reveals the tier
      └──────── + keeper retry ─────────────
```

**Flow:** signup (stock ATAs + Player init + delegate + session key) → deposit USDC (eSPL onto the rollup) → `buy_card` signed by the session key on the rollup → `RandomnessPending` → VRF callback → `Revealed` → scratch (cosmetic) → `claim_all` (commit + Magic Action) → the base-layer `pay_out` handler transfers shares and creates a `Payout` receipt → the client confirms the shares arrived → hold, or sell.

**Card states:** `Empty → Paid → RandomnessPending → Revealed → ClaimRequested → Settled`, plus `RandomnessPending → Cancelled` (refunded) on VRF timeout. `Settled` and `Cancelled` slots can be reused.

### MagicBlock rules (hard constraints)

- Pin `ephemeral-rollups-sdk` (Rust) and `@magicblock-labs/ephemeral-rollups-sdk` (TS) to **0.18.x**. On 0.20, `#[vrf]` doesn't compile. Use the Anchor version that 0.18.x's own Cargo.toml expects.
- Rust features: `anchor`, `vrf`, `spl`.
- **VRF:**
  - A request is not a result: the UI shows "randomness pending".
  - Store `vrf_request_id` in the card slot. The callback must match it and be idempotent: a second callback for the same request does nothing or fails.
  - Requests can take more than 2 minutes and the fee isn't refunded. `cancel_pending` (after `series.vrf_timeout_s`) voids the request ID so a late callback is rejected.
  - Mix in player randomness through `caller_seed` (client-generated 32 bytes).
- **No temporary rollup accounts for cards:** cards live inside the delegated `Player` account.
- **Commits:**
  - An account can be committed at most 10 times per delegation without the fee vault. With `magic_fee_vault`, every commit from the 26th on costs 0.001 SOL per account.
  - Accounts over 10,240 bytes won't commit.
  - Batch claims, and configure VaultState commits with a delegated payer + `magic_fee_vault`.
- **Magic Actions:** a successful commit doesn't prove the action ran, and one failed action drops every action batched with it. The client and keeper must confirm shares on Solana, and the keeper retries.
- **Stock stays on Solana; only USDC goes on the rollup (eSPL).** Create stock ATAs at signup.
- **Session keys don't authorize spending:** also enforce a capped spend allowance. Check whether eSPL on the rollup supports SPL `approve` to the session key. If it doesn't, enforce `session_spend_remaining` in the Player account in program logic, and record which option you used in DECISIONS.md.
- **Swaps:** the MagicBlock Payments API (`/v1/swap/quote` → `/v1/swap/swap`) won't route mock devnet mints. Build `sell_to_vault` / a mock pool behind an SDK `sell()` interface whose mainnet implementation calls the Payments API (implemented and typed, but disabled on devnet).
- Outage handling: poll `https://status.magicblock.app/api/services` and show a banner when the rollup, VRF or oracle is degraded.

---

## 4. On-chain program spec (`programs/scratchers`)

### Accounts

| Account | Seeds | Lives | Key fields |
|---|---|---|---|
| `Config` | `["config"]` | Solana | `admin`, `keeper`, `usdc_mint`, `paused`, `bump` |
| `Series` | `["series", id u16]` | Solana (read on ER) | `id`, `stock_mint`, `price_source`, `feed`, `feed_expo`, `ticket_usd_e6`, `tiers [Tier; 8]` (`multiplier_bps u32`, `weight u32`), `total_weight`, `frozen`, `demo`, `max_staleness_s`, `max_move_bps`, `max_conf_bps`, `vrf_timeout_s`, `last_price` |
| `Player` | `["player", authority]` | **delegated** | `authority`, `usdc_balance_e6`, `next_card_id u64`, `cards [Card; 32]`, `session_key`, `session_expiry`, `session_spend_remaining_e6`, `bump`. **Assert size < 10,240 in a test.** |
| `Card` (struct) | n/a | inside Player | `id u64`, `series u16`, `state u8`, `tier u8`, `vrf_request_id [u8;32]`, `seed [u8;32]`, `locked_price u64`, `shares u64`, `paid_ts i64`, `revealed_ts i64` |
| `VaultState` | `["vault", stock_mint]` | **delegated** | `usdc_in_e6`, `reserved_shares`, `available_shares_mirror`, `bump` |
| `PriceFeed` | `["feed", feed_id]` | **delegated** | see §2 Path B |
| `Payout` | `["payout", player, card_id]` | Solana | `shares`, `ts`. Created exactly once, so a second create fails, which makes retries safe. |
| `Stats` | `["stats", series]` | delegated | cards sold, payouts per tier, shares paid |

### Instructions

**Solana:**

- `init_config`, `create_series`, `freeze_series`
- `init_vault`, `fund_vault` (admin deposits stock and bumps the mirror on the next rollup sync through `sync_inventory` on the ER, signed by the admin)
- `signup` (create Player and stock ATAs), `delegate_player`, `delegate_vault`, `delegate_feed`
- `pay_out` (the Magic Action target, also callable by the keeper): verifies the committed card is `ClaimRequested`, creates `Payout`, and transfers `shares` from the vault to the player's ATA
- `undelegate_*`

**Rollup:**

- `deposit_usdc` / `withdraw_usdc` (eSPL in/out)
- `create_session(session_key, expiry, cap)`, `revoke_session`
- `buy_card(series, n ≤ 10, max_price, caller_seed)`, signed by the session key:
  - checks the price, session, cap, and balance
  - checks liability: `available − reserved ≥ n × max_multiplier_bps × ticket ÷ 10,000 ÷ price` (max = Grail, 1,000×)
  - reserves that liability, debits USDC, puts the card in `Paid`, then requests VRF (→ `RandomnessPending`)
- `vrf_callback`: matches the request ID → tier from the seed → `shares` → releases the excess reservation → `Revealed`
- `cancel_pending`: after the timeout, refunds, releases the reservation, voids the request → `Cancelled`
- `claim_all`: every `Revealed` winning card → `ClaimRequested`, then a commit + Magic Action batch calling `pay_out` per card. Losing cards go straight to `Settled`.
- `mark_settled` (keeper or client after confirming the `Payout` exists)
- `push_price` (Path B)
- `sell_to_vault` (devnet sell at the validated price, with USDC credited on the rollup)

### Errors

`Paused, SeriesNotFrozen, PriceStale, PriceOutOfBand, PriceAboveMax, WrongFeed, InsufficientBalance, SessionExpired, SessionCapExceeded, NoFreeSlot, InsufficientInventory, VrfRequestMismatch, AlreadyRevealed, NotTimedOut, AlreadyPaid, BadState`

### Events

`CardBought, CardRevealed, CardCancelled, ClaimRequested, PaidOut, PriceUpdated`

### Tests (`anchor test` + rollup integration scripts)

- Weights/RTP, tier selection at boundary values, Player size limit
- Duplicate VRF callback, late callback after cancel
- Stale, wrong-owner and out-of-band feeds, and a price above `max_price`
- Expired session that still has a cap; valid session with no cap; cap exhaustion
- Insufficient inventory blocks buys
- Dropped Magic Action → keeper `pay_out` repairs it → a second `pay_out` fails with `AlreadyPaid`
- Commit-limit behaviour with the fee vault configured

---

## 5. Repo layout

```
stock-scratchers/                 pnpm + Turborepo
├─ programs/scratchers/           Anchor program
├─ packages/sdk/                  Shared TS client: web, mobile, keeper, scripts
│   ├─ connections.ts             Solana / router / rollup endpoint selection (getDelegationStatus)
│   ├─ signer.ts                  Signer interface + PrivySigner, MwaSigner, SessionKeySigner
│   ├─ instructions.ts            signup, deposit, withdraw, createSession, buyCard, cancelPending,
│   │                             claimAll, sell
│   ├─ accounts.ts                decoders + rollup websocket subscriptions (subscribeCards, subscribePrice)
│   ├─ price.ts                   reads either price source, formats with the right exponent
│   ├─ cardArt.ts                 seed → 9 panel symbols (deterministic, shared with the verify page)
│   └─ generated/                 IDL-generated client (regenerate whenever the IDL changes)
├─ packages/ui-tokens/            colours, tier palette, motion timings/curves (web + native)
├─ packages/animations/           .riv / Lottie files
├─ apps/web/                      Next.js (App Router) + @privy-io/react-auth
├─ apps/mobile/                   Expo SDK 54+ dev build, Android-first (Seeker)
├─ services/keeper/               payout retries, Hermes price pusher, vault inventory sync, staleness watcher
├─ scripts/                       devnet setup: mints, series, vault funding, e2e loop
└─ docs/                          PROGRESS.md, DECISIONS.md, DEPLOYMENTS.md, ARCHITECTURE.md
```

**Rule:** all on-chain logic lives in `packages/sdk`. The apps only render and call the SDK.

---

## 6. Wallets and signing

**One `Signer` interface** in the SDK:

```ts
interface Signer {
  publicKey: PublicKey;
  signTransaction(tx: Transaction | VersionedTransaction): Promise<typeof tx>;
  signAllTransactions?(txs: Transaction[]): Promise<Transaction[]>;
}
```

- **PrivySigner** (web: `@privy-io/react-auth`; mobile: `@privy-io/expo`):
  - Embedded Solana wallet. **Sign only, never sign-and-send**, because Privy's send goes to Solana RPC.
  - Use the same Privy app ID on both platforms so a user has one wallet.
  - Logins: email, Google, plus Apple if configured.
- **MwaSigner** (mobile, Seeker): use Solana Mobile's **Seeker Connect** (`@solana-mobile/seeker-connect-react-native`) / MWA through `@wallet-ui/react-native-web3js`, the web3.js flavour, to match the MagicBlock TS SDK. On Seeker devices, show "Connect with Seeker" first (detect Seeker as the Solana Mobile docs describe). The wallet only signs **Solana-layer** transactions (signup, delegation, deposit, session creation), so sign-and-send is fine there.
- **SessionKeySigner:** an ed25519 keypair created at session start and kept in `expo-secure-store` on mobile and in memory on web. It signs every `buy_card` / `claim_all` / `cancel_pending` locally and sends to the **rollup** endpoint, with no popups.
- Signup should take at most two user approvals in total.

**Funding new users on devnet:** a "Get test funds" button that requests a devnet SOL airdrop (or a fee-payer sponsor via a small keeper endpoint) and mints 50 mock USDC from a faucet instruction or keeper endpoint. Without this, nobody can try the app.

---

## Design source

The UI follows the **Holo cards** direction on the design canvas (<https://claude.ai/artifact/61kjPFuKgZfocfo95Pw879>): the "B · Holo cards (full flow)" page for mobile, "B · Desktop" for web, and the Rarities row for each rarity's finish (frame, holo coverage, full-bleed art for Mythic and Grail). Match its colours (`#0D0B14` ground, `#F2EFFA` card, `#9DF3FF` accent, one colour per rarity), type (Bricolage Grotesque + Space Mono), the HoloCard and HoloPack components, and the copy. Rarity names map 1:1 to the prize table in §1. Company logos are not in the mockups; only add one if you have the right to use it. Where §7–9 below still say "scratch", the holo design replaces it with ripping a pack and flipping each card; build the flip.

## 7. Web app (`apps/web`)

Pages:

- `/`: landing page with the hero card and a buy CTA
- `/play`: series picker, buy 1 / buy 10, pack-opening animation, scratch grid, claim all
- `/portfolio`: holdings, live sparkline (`lightweight-charts`) from rollup prices, P/L since each win, sell
- `/prizes`: the public prize table read from chain
- `/verify`: paste a card ID → fetch seed + series → recompute tier + panels with `cardArt` → show a match
- `/dashboard`: public stats (actual vs. expected payout per tier, vault health, reserved vs. available)

Components:

- canvas scratch using `globalCompositeOperation = "destination-out"`, mouse + touch, auto-reveal at about 60% cleared
- `motion` for UI animation
- `canvas-confetti`
- `@rive-app/react-canvas`

Global banners: randomness pending, price paused / market closed, payout settling, MagicBlock degraded. Deploy to Vercel.

## 8. Mobile app (`apps/mobile`, Seeker / Android)

- Expo SDK **54+** dev build (`expo-dev-client`), not Expo Go.
- Polyfills: `buffer`, `react-native-get-random-values`, plus anything Privy and web3.js need.
- Screens mirror web: Login (Seeker Connect / Privy), Play, Portfolio, Prizes, Verify.
- Scratch: `@shopify/react-native-skia` mask + `react-native-gesture-handler` + `react-native-reanimated`, haptic ticks with `expo-haptics`, auto-reveal at about 60%.
- Animation: `moti`/Reanimated sharing `ui-tokens` timings, `rive-react-native`, Skia particles or `lottie-react-native`.
- Charts: `react-native-wagmi-charts`.
- Test with Solana Mobile's mock MWA wallet on an emulator or any Android phone. Use a real Seeker for the final video if you can get one.
- Ship a signed release APK (EAS) and prepare the Solana dApp Store listing (publisher portal). iOS is optional.

## 9. Animations (both platforms, timings from `ui-tokens`)

- Rarity-scaled reveals (see the Dust rule in §1):
  - Dust 0.2×: no celebration. Plain flip, greyscale card, "20¢ back" label.
  - Common 1×: quiet "money back" flip, no confetti.
  - Uncommon 2× – Epic 10×: holo sweep + coin burst, stronger with rarity
  - Legend 50× – Mythic 100×: screen shake + confetti
  - **Grail 1,000×:** full-screen Rive moment + long haptic pattern
- Pack opening: 10 cards fan out with a staggered spring animation
- Prize counter: count-up in dollars (wins only, never for Dust)
- Pending card: shimmer skeleton
- Win flies into the portfolio tab
- All card art and branding is original, not copied from the reference projects.

## 10. Keeper (`services/keeper`, Node + SDK)

Deployed on Railway or Fly with structured logs.

1. **Payout repair:** watch `ClaimRequested` cards. If no `Payout` PDA exists after N seconds, call `pay_out`. Exactly-once comes from the PDA, and retries are keyed by `(player, card_id)`.
2. **Price pusher (Path B):** Hermes → `push_price` on the rollup about every 400 ms during market hours.
3. **Inventory sync:** after `fund_vault` or a refill, call `sync_inventory` on the rollup.
4. **Vault refill:** devnet mock refill (mint mock stock to the vault); mainnet would use the Payments API swap.
5. **Staleness watcher:** alerts and a metrics endpoint.
6. **Faucet endpoint** for test funds (rate-limited per wallet).

## 11. Reference projects (patterns only)

- `magicblock-labs/magicblock-engine-examples` (roll-dice: VRF + ER loop)
- `magicblock-labs/real-time-pricing-oracle` (oracle layout, consumer example)
- `privy-io/expo-starter` (polyfills, embedded Solana wallet)
- Solana Mobile `create-solana-dapp` Expo templates + Seeker Connect examples

---

## 12. Build order and acceptance criteria

Today is Day 1. **First, confirm the submission deadline at build.magicblock.app** and write it at the top of `docs/PROGRESS.md`.

### Day 1: risks and skeleton

1. Init the monorepo + git (§13), `.gitignore`, `.env.example`, docs files.
2. Anchor scaffold with the pinned SDK. Accounts `Config`, `Series`, `Vault`, `VaultState`, `Player` (with a size test).
3. Delegate / commit / undelegate instructions.
4. `buy_card` → VRF → callback reveals the tier in local tests.
5. Devnet scripts: mock USDC, mTSLA, mNVDA, mSOL mints, series creation, vault funding.
6. SDK skeleton: connection routing, generated client, `Signer` interface.
7. **Mobile risk test:** Expo 54 dev build + Privy + Seeker Connect (mock wallet). Sign with **both** wallets. Create a session key and send a session-key-signed transaction to the rollup endpoint.
8. Next.js + Privy login + embedded wallet.
9. Design tokens, tier palette, first card design, first Rive file.

✅ Both apps log in (web: Privy; mobile: Privy **and** Seeker), a transaction lands on the rollup, and the VRF reveal test passes.

### Day 2: the core loop on chain

- Price module (Path A + Path B + `push_price`), market-hours behaviour
- Full card state machine, request-ID binding, idempotent callback, `cancel_pending`
- Reserved liability accounting, slot reuse
- eSPL deposit and withdraw, session + spend cap
- SDK `buyCard(n)`, `subscribeCards()`, `cardArt(seed)`
- Scratch components on web and mobile (mock data)
- Landing page + prize table page

✅ A devnet script deposits → buys 10 → gets 10 VRF reveals, and both scratch UIs feel good.

### Day 3: settlement and wiring both apps

- `claim_all` + Magic Action → `pay_out` + `Payout` receipt; VaultState commits with `magic_fee_vault`
- Auto-pause when the price is stale; signup flow (ATAs, Player, delegation, session)
- Devnet deploy (record it in DEPLOYMENTS.md)
- Both apps wired end to end; verify page; test-funds faucet
- Keeper: payout repair + price pusher, deployed

✅ On the phone and in the browser: login → get test funds → deposit → buy 10 → scratch → claim → shares appear in the wallet on devnet.

### Day 4: portfolio, selling, animations

- `sell_to_vault` + SDK `sell()` (Payments API implementation behind a flag), vault refill, Stats
- All animations in §9; portfolio with sparklines and P/L; public dashboard; demo series

✅ The full flow feels finished on both platforms, and the jackpot animation is demo-ready.

### Day 5: hardening and shipping

- Run every §4 test plus the UI states for pending / paused / settling / degraded
- Web → Vercel; Android → signed APK + dApp Store listing
- README + architecture diagram
- 2–3 minute demo video (phone + web side by side)
- Submit at build.magicblock.app
- Code freeze 3 hours before the deadline; after that, fixes only.

**Demo script:**

1. Log in on Seeker → deposit $50
2. Buy 10 TSLA cards (or SOL if the market is closed) → pack opening
3. Flip → Rare 5× → count-up + coin burst (and show one Dust card flipping plainly)
4. Claim → shares in the wallet
5. Web with the same Privy login → live price
6. Sell one
7. Verify page recomputes the card

---

## 13. Git strategy (mandatory)

### Setup (first thing on Day 1)

- `git init`, default branch `main`, create a **private GitHub remote** and push immediately. Push after every commit; the remote is the backup.
- Commit `.gitignore` before anything else. It must cover: `node_modules/`, `.next/`, `dist/`, `build/`, `target/` (keep `target/idl` and `target/types` committed only if the SDK generation needs them; otherwise generate into `packages/sdk/generated`), `.anchor/`, `test-ledger/`, `.expo/`, `android/`/`ios/` if prebuild output is regenerated, `*.keystore`, `.env*` (except `.env.example`), **all keypair files** (`*-keypair.json`, `id.json`, `target/deploy/*.json`), `*.log`, `.DS_Store`.
- Before each commit, run `git diff --cached --name-only` and abort if any path looks like a key, keystore or `.env` file. Add a `scripts/check-secrets.sh` pre-commit hook (or `gitleaks` if it's available) that blocks commits containing private keys, `PRIVY_APP_SECRET`, auth tokens or base58 64-byte keypairs.

### Branching

- `main` must always build and pass tests.
- Single-step changes can be committed straight to `main` if they pass the checks below.
- Multi-step or risky work goes on a short-lived branch: `feat/<scope>-<thing>`, `fix/<scope>-<thing>`, `chore/<thing>` (for example `feat/program-vrf-callback`, `feat/mobile-seeker-connect`). Merge back the same day with `git merge --no-ff` so the feature stays grouped in history, then delete the branch.
- `wip:` commits are allowed **only on branches**. Squash them into meaningful commits before merging.
- Never force-push `main`, never rewrite pushed history, and never `--amend` a pushed commit.

### What counts as a "significant update": commit every time one happens

1. A new or changed **account, instruction, error or event** in the program.
2. Any **IDL change**: commit the program change **together with** the regenerated SDK client, in one commit, so they never drift apart.
3. A **test** added, or a previously failing test now passing.
4. A **feature works end to end** at any layer (for example "VRF reveal passes locally", "Seeker wallet signs").
5. A **dependency, version pin or toolchain change** (with the lockfile).
6. A **config / env / build setting** change (`Anchor.toml`, `app.json`/`eas.json`, `next.config`, turbo/pnpm config, `.env.example`).
7. A **bug fix** (one fix per commit).
8. Before and after any **refactor** that touches more than one file.
9. A **devnet deploy or program upgrade**: commit `docs/DEPLOYMENTS.md` with the program ID, slot/tx signature, git SHA and date.
10. A new screen, component or animation that renders correctly.
11. Any `docs/DECISIONS.md` entry.
12. **Time backstop:** never let working changes sit uncommitted for more than about 45 minutes. If the work is in progress, commit to a branch as `wip:`.

### Before every commit

- Run the checks for the affected packages: `anchor build` (+ `anchor test` if the program changed), `pnpm -w turbo run typecheck lint test --filter=<changed>...`.
- Don't commit to `main` with failing checks. If you have to save broken work, use a branch + `wip:`.
- Stage deliberately: `git add -p` or explicit paths, never a blind `git add .`.

### Commit messages: Conventional Commits

```
<type>(<scope>): <imperative summary, ≤ 72 chars>

<what changed and why; link to the plan step, e.g. "Plan Day 2: cancel_pending">
<breaking changes / migration notes if any>
```

- Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `perf`, `build`, `ci`
- Scopes: `program`, `sdk`, `web`, `mobile`, `keeper`, `ui`, `anim`, `scripts`, `infra`, `docs`
- Examples:
  - `feat(program): add vrf_callback with request-id binding and idempotency`
  - `feat(program,sdk): add claim_all magic action and regenerate client`
  - `fix(mobile): polyfill crypto.getRandomValues before Privy init`
  - `chore(deploy): devnet program upgrade 3 — see DEPLOYMENTS.md`

### Milestone tags

At each ✅ in §12: update `docs/PROGRESS.md`, commit, and tag it: `git tag -a day1-done -m "..."`, `day2-done`, `day3-e2e`, `day4-polish`, `v1.0-submission`. Push the tags (`git push --follow-tags`).

### Report back

After each commit, tell me in one line: the commit hash, the message, and whether checks passed. After each milestone tag, give me a short summary of what works and what's next.

---

## 14. Start now

1. Confirm the deadline and write it into `docs/PROGRESS.md`.
2. Set up the repo, `.gitignore`, the secret-check hook and the remote. Commit: `chore(infra): init monorepo, gitignore, secret check`.
3. Draft a message for me to send in the MagicBlock Blitz Telegram, asking whether they can push Pyth Lazer TSLA/USD and NVDA/USD on the devnet rollup. Until they answer, build Path B.
4. Begin Day 1, step 2.
