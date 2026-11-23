# Progress

**Submission deadline: UNCONFIRMED** — build.magicblock.app landing page is client-rendered and shows no date (checked 2026-11-24). Owner to confirm; update here. Code freeze = deadline − 3h.

## Day 1
- [x] Repo init, gitignore, secret-check hook
- [x] Anchor scaffold: Config, Series, VaultState, Player (zero-copy, size-tested); `anchor build --arch v0` + 4 unit tests green (weights/RTP=76%, tier boundaries, Player < 10,240 B)
- [x] Delegate / undelegate (player, vault, feed), sessions, push_price, buy_card + VRF, callback, cancel_pending (steps 3-4)
- [x] MagicSVM gate green: buy 10 → 10 VRF reveals; late/spoofed callbacks rejected (`cd tests/magicsvm && cargo +1.93.0 test`)
- [x] SDK skeleton: generated client, connections/router, Signer, PDAs, tier math, instruction builders (7 tests)
- [ ] Devnet scripts: mints, series, vault funding (step 5)
- [ ] ...

## Blocked / needs owner
- Deadline date
- Privy app ID/secret, Telegram message to MagicBlock (see docs/TELEGRAM_DRAFT.md)
