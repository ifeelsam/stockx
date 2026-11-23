# Decisions

| Date | Decision | Reason |
|---|---|---|
| 2026-11-24 | Price source defaults to Path B (self-pushed) for equities | MagicBlock oracle feed list is crypto-only; awaiting their answer |
| 2026-11-24 | Anchor CLI/lib **1.0.2** (exact `=1.0.2`, all `anchor-*` sub-crates pinned in Cargo.lock) + `ephemeral-rollups-sdk =0.18.0` feature `anchor` | SDK `anchor` feature = Anchor 1.x. Without exact pins `anchor-lang` floats to 1.2.2 and macro crates mismatch (`create_account_allow_prefund` missing). Re-pin with `cargo update -p <crate> --precise 1.0.2` if the lock is regenerated |
| 2026-11-24 | SDK features `anchor,vrf` only; `spl` **dropped** from the program crate | `spl` pulls a host-side `solana-sdk` tree with duplicate `solana-message` (2.4/3.1) that fails to build for SBF. eSPL on the rollup shows up as a plain SPL token account (SDK lifecycle model), so plain SPL CPI is enough; client SDK handles eSPL deposit/withdraw. Revisit if we need `ephemeral-spl-api` CPI |
| 2026-11-24 | `getrandom` 0.3 stub backend for SBF (`.cargo/config.toml` cfg + `__getrandom_v03_custom` in lib.rs) | `solana-address` enables `rand`; nothing calls it on-chain |
| 2026-11-24 | `Player` is `#[account(zero_copy)]` (3.6 KB, 112-byte `Card`, no implicit padding) | Borsh deserialization of 3.5 KB blows the 4 KB BPF stack; also keeps it far under the 10,240-byte commit limit (unit-tested) |
| 2026-11-24 | Moved to **Anchor 1.2.2** (CLI via avm, `anchor-*` crates `=1.2.2`) and build with `anchor build --arch v0` | 1.2.2 CLI defaults to platform-tools v1.57 + SBPF **v3** (target `sbpfv3-solana-solana`). v0 keeps the ER validator-safe, known target and the `.cargo/config.toml` getrandom cfg. Always pass `--arch v0` |
| 2026-11-24 | `spl` feature of `ephemeral-rollups-sdk` re-tested on Anchor 1.2.2: **still unsupported**, stays off | With `spl`, SBF build fails on both v0 and v3 with "overflows the maximum allowed frame space" in `curve25519_dalek` / `solana_ed25519` (solana-sdk crypto linked into the program). Without it the build is clean. Retest when the SDK moves `solana-sdk` behind a non-program feature |
