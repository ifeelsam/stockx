use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod error;
pub mod events;
pub mod instructions;
pub mod price;
pub mod state;

use instructions::*;

declare_id!("EQaiygfGRcn53N3EEMArDapzcw54iZL6UcuTpSPu2Ygn");

#[ephemeral]
#[program]
pub mod scratchers {
    use super::*;

    // ---- Solana (base layer) ----
    pub fn init_config(ctx: Context<InitConfig>, keeper: Pubkey, usdc_mint: Pubkey) -> Result<()> {
        instructions::init_config(ctx, keeper, usdc_mint)
    }
    pub fn create_series(ctx: Context<CreateSeries>, args: CreateSeriesArgs) -> Result<()> {
        instructions::create_series(ctx, args)
    }
    pub fn freeze_series(ctx: Context<FreezeSeries>) -> Result<()> {
        instructions::freeze_series(ctx)
    }
    pub fn init_vault(ctx: Context<InitVault>) -> Result<()> {
        instructions::init_vault(ctx)
    }
    pub fn init_feed(ctx: Context<InitFeed>, feed_id: [u8; 32], pusher: Pubkey, expo: i32, max_move_bps: u16) -> Result<()> {
        instructions::init_feed(ctx, feed_id, pusher, expo, max_move_bps)
    }
    pub fn init_stats(ctx: Context<InitStats>, series_id: u16) -> Result<()> {
        instructions::init_stats(ctx, series_id)
    }
    pub fn delegate_stats(ctx: Context<DelegateStats>, series_id: u16, validator: Option<Pubkey>) -> Result<()> {
        instructions::delegate_stats(ctx, series_id, validator)
    }
    pub fn signup(ctx: Context<Signup>) -> Result<()> {
        instructions::signup(ctx)
    }
    pub fn delegate_player(ctx: Context<DelegatePlayer>, validator: Option<Pubkey>) -> Result<()> {
        instructions::delegate_player(ctx, validator)
    }
    pub fn delegate_vault(ctx: Context<DelegateVault>, validator: Option<Pubkey>) -> Result<()> {
        instructions::delegate_vault(ctx, validator)
    }
    pub fn delegate_feed(ctx: Context<DelegateFeed>, feed_id: [u8; 32], validator: Option<Pubkey>) -> Result<()> {
        instructions::delegate_feed(ctx, feed_id, validator)
    }

    /// Magic Action target (base layer); only reachable via the delegation program's escrow signature.
    pub fn pay_out_action(ctx: Context<PayOutAction>, card_id: u64) -> Result<()> {
        instructions::pay_out_action(ctx, card_id)
    }
    /// Keeper repair path (base layer).
    pub fn pay_out(ctx: Context<PayOut>, card_id: u64) -> Result<()> {
        instructions::pay_out(ctx, card_id)
    }

    /// Admin: create the base-layer sell quote + the USDC sell pool for a stock mint.
    pub fn init_sell_quote(ctx: Context<InitSellQuote>, price_e8: u64, ts: i64) -> Result<()> {
        instructions::init_sell_quote(ctx, price_e8, ts)
    }
    /// Keeper: post a fresh sell quote.
    pub fn set_sell_quote(ctx: Context<SetSellQuote>, price_e8: u64, ts: i64) -> Result<()> {
        instructions::set_sell_quote(ctx, price_e8, ts)
    }
    /// Player: sell stock shares to the vault at the quote (devnet mock pool; mainnet uses the Payments API).
    pub fn sell_to_vault(ctx: Context<SellToVault>, shares: u64, min_usdc_e6: u64) -> Result<()> {
        instructions::sell_to_vault(ctx, shares, min_usdc_e6)
    }
    /// Keeper: record that sold shares were credited to the rollup inventory mirror.
    pub fn ack_sold(ctx: Context<AckSold>, total_synced: u64) -> Result<()> {
        instructions::ack_sold(ctx, total_synced)
    }

    // ---- Ephemeral rollup ----
    pub fn undelegate_player(ctx: Context<UndelegatePlayer>) -> Result<()> {
        instructions::undelegate_player(ctx)
    }
    pub fn undelegate_stats(ctx: Context<UndelegateStats>) -> Result<()> {
        instructions::undelegate_stats(ctx)
    }
    pub fn undelegate_vault(ctx: Context<UndelegateVault>) -> Result<()> {
        instructions::undelegate_vault(ctx)
    }
    pub fn undelegate_feed(ctx: Context<UndelegateFeed>) -> Result<()> {
        instructions::undelegate_feed(ctx)
    }
    /// Move USDC from the user's rollup token account into the program treasury and credit the ledger.
    pub fn deposit_usdc(ctx: Context<Funds>, amount: u64) -> Result<()> {
        instructions::deposit_usdc(ctx, amount)
    }
    pub fn withdraw_usdc(ctx: Context<Funds>, amount: u64) -> Result<()> {
        instructions::withdraw_usdc(ctx, amount)
    }
    pub fn sync_inventory(ctx: Context<SyncInventory>, added_shares: u64) -> Result<()> {
        instructions::sync_inventory(ctx, added_shares)
    }
    pub fn create_session(ctx: Context<Session>, session_key: Pubkey, expiry: i64, cap_e6: u64) -> Result<()> {
        instructions::create_session(ctx, session_key, expiry, cap_e6)
    }
    pub fn revoke_session(ctx: Context<Session>) -> Result<()> {
        instructions::revoke_session(ctx)
    }
    pub fn push_price(ctx: Context<PushPrice>, price: i64, conf: u64, publish_ts: i64) -> Result<()> {
        instructions::push_price(ctx, price, conf, publish_ts)
    }
    pub fn buy_card(ctx: Context<BuyCard>, n: u8, max_price: u64, caller_seed: [u8; 32]) -> Result<()> {
        instructions::buy_card(ctx, n, max_price, caller_seed)
    }
    pub fn vrf_callback(ctx: Context<VrfCallback>, randomness: [u8; 32], card_id: u64, request_id: [u8; 32]) -> Result<()> {
        instructions::vrf_callback(ctx, randomness, card_id, request_id)
    }
    pub fn claim_all(ctx: Context<ClaimAll>, series_id: u16) -> Result<()> {
        instructions::claim_all(ctx, series_id)
    }
    pub fn mark_settled(ctx: Context<MarkSettled>, card_id: u64) -> Result<()> {
        instructions::mark_settled(ctx, card_id)
    }
    pub fn cancel_pending(ctx: Context<CancelPending>, card_id: u64) -> Result<()> {
        instructions::cancel_pending(ctx, card_id)
    }
}

// getrandom 0.3 has no SBF backend; rand is a transitive dep that is never called on-chain.
// Needs RUSTFLAGS='--cfg getrandom_backend="custom"' (set in .cargo/config.toml).
#[cfg(target_os = "solana")]
#[no_mangle]
unsafe extern "Rust" fn __getrandom_v03_custom(_dest: *mut u8, _len: usize) -> core::result::Result<(), getrandom::Error> {
    core::result::Result::Err(getrandom::Error::UNSUPPORTED)
}
