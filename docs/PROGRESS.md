# Progress

**Submission deadline: UNCONFIRMED** — build.magicblock.app landing page is client-rendered and shows no date (checked 2026-11-24). Owner to confirm; update here. Code freeze = deadline − 3h.

## Day 1
- [x] Repo init, gitignore, secret-check hook
- [x] Anchor scaffold: Config, Series, VaultState, Player (zero-copy, size-tested); `anchor build --arch v0` + 4 unit tests green (weights/RTP=76%, tier boundaries, Player < 10,240 B)
- [x] Delegate / undelegate (player, vault, feed), sessions, push_price, buy_card + VRF, callback, cancel_pending (steps 3-4)
- [x] MagicSVM gate green: buy 10 → 10 VRF reveals; late/spoofed callbacks rejected (`cd tests/magicsvm && cargo +1.93.0 test`)
- [x] SDK skeleton: generated client, connections/router, Signer, PDAs, tier math, instruction builders (7 tests)
- [x] Devnet setup script `pnpm --filter @scratchers/scripts setup:devnet` (mints, config, feeds, 4 series incl. DEMO, vaults, funding, delegation, inventory sync). Base-layer half verified on a local validator, idempotent. **Delegation + rollup sync not yet run: needs devnet SOL**
- [ ] ...

## Blocked / needs owner
- **Devnet SOL for the deployer** (~6 SOL: program deploy ≈ 4 + setup). `solana airdrop` and MagicBlock's RPC are rate-limited. Deployer: `solana address -k ~/.config/stockx/deployer.json` → fund at https://faucet.solana.com, then I deploy + run setup
- **Price relay source**: `hermes.pyth.network` price endpoints now return **401 Unauthorized** (feed search still open). The keeper needs an authenticated Hermes-compatible endpoint or API key (e.g. a Pyth/RPC-provider key). Until then the keeper gets a pluggable source with a dev random-walk fallback
- Deadline date
- Privy app ID/secret, Telegram message to MagicBlock (see docs/TELEGRAM_DRAFT.md)

- [x] Settlement (Day 3 core, ahead of schedule): claim_all → commit + Magic Action → pay_out + Payout receipt, keeper repair, mark_settled; 9 MagicSVM tests green
