use crate::{error::ScratchError, price::PriceSource, state::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn init_config(ctx: Context<InitConfig>, keeper: Pubkey, usdc_mint: Pubkey) -> Result<()> {
    *ctx.accounts.config = Config {
        admin: ctx.accounts.admin.key(),
        keeper,
        usdc_mint,
        paused: false,
        bump: ctx.bumps.config,
    };
    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateSeriesArgs {
    pub id: u16,
    pub price_source: PriceSource,
    pub feed: Pubkey,
    pub feed_expo: i32,
    pub ticket_usd_e6: u64,
    pub tiers: [Tier; NUM_TIERS],
    pub total_weight: u32,
    pub demo: bool,
    pub max_staleness_s: i64,
    pub max_move_bps: u16,
    pub max_conf_bps: u16,
    pub vrf_timeout_s: i64,
}

#[derive(Accounts)]
#[instruction(args: CreateSeriesArgs)]
pub struct CreateSeries<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ScratchError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(init, payer = admin, space = 8 + Series::INIT_SPACE, seeds = [b"series", args.id.to_le_bytes().as_ref()], bump)]
    pub series: Account<'info, Series>,
    pub stock_mint: Account<'info, anchor_spl::token::Mint>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn create_series(ctx: Context<CreateSeries>, a: CreateSeriesArgs) -> Result<()> {
    Series::validate_table(&a.tiers, a.total_weight)?;
    *ctx.accounts.series = Series {
        id: a.id,
        stock_mint: ctx.accounts.stock_mint.key(),
        price_source: a.price_source,
        feed: a.feed,
        feed_expo: a.feed_expo,
        ticket_usd_e6: a.ticket_usd_e6,
        tiers: a.tiers,
        total_weight: a.total_weight,
        frozen: false,
        demo: a.demo,
        max_staleness_s: a.max_staleness_s,
        max_move_bps: a.max_move_bps,
        max_conf_bps: a.max_conf_bps,
        vrf_timeout_s: a.vrf_timeout_s,
        last_price: 0,
        bump: ctx.bumps.series,
    };
    Ok(())
}

#[derive(Accounts)]
pub struct FreezeSeries<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ScratchError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"series", series.id.to_le_bytes().as_ref()], bump = series.bump)]
    pub series: Account<'info, Series>,
    pub admin: Signer<'info>,
}

pub fn freeze_series(ctx: Context<FreezeSeries>) -> Result<()> {
    ctx.accounts.series.frozen = true;
    Ok(())
}

#[derive(Accounts)]
pub struct InitVault<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ScratchError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(init, payer = admin, space = 8 + VaultState::INIT_SPACE, seeds = [b"vault", stock_mint.key().as_ref()], bump)]
    pub vault_state: Account<'info, VaultState>,
    pub stock_mint: Account<'info, anchor_spl::token::Mint>,
    /// Stock vault token account, owned by the vault_state PDA.
    #[account(
        init, payer = admin,
        associated_token::mint = stock_mint, associated_token::authority = vault_state,
    )]
    pub vault_token: Account<'info, anchor_spl::token::TokenAccount>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, anchor_spl::token::Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn init_vault(ctx: Context<InitVault>) -> Result<()> {
    *ctx.accounts.vault_state = VaultState {
        stock_mint: ctx.accounts.stock_mint.key(),
        usdc_in_e6: 0,
        reserved_shares: 0,
        available_shares_mirror: 0,
        bump: ctx.bumps.vault_state,
    };
    Ok(())
}
