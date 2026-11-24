//! Selling stock back to the vault. Stock lives on Solana, so this is one atomic base-layer
//! instruction against a keeper-posted `SellQuote`: shares in, USDC out of a Config-PDA pool.
use crate::{error::ScratchError, events::SoldToVault, state::*};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

#[derive(Accounts)]
pub struct InitSellQuote<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ScratchError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(init, payer = admin, space = 8 + SellQuote::INIT_SPACE, seeds = [b"quote", stock_mint.key().as_ref()], bump)]
    pub quote: Account<'info, SellQuote>,
    pub stock_mint: Account<'info, Mint>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: Account<'info, Mint>,
    /// USDC the program pays sellers from (owned by the Config PDA). Fund it with plain transfers.
    #[account(init_if_needed, payer = admin, associated_token::mint = usdc_mint, associated_token::authority = config)]
    pub sell_pool: Account<'info, TokenAccount>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn init_sell_quote(ctx: Context<InitSellQuote>, price_e8: u64, ts: i64) -> Result<()> {
    require!(price_e8 > 0, ScratchError::PriceOutOfBand);
    *ctx.accounts.quote = SellQuote {
        stock_mint: ctx.accounts.stock_mint.key(),
        price_e8,
        ts,
        total_sold_shares: 0,
        synced_sold_shares: 0,
        bump: ctx.bumps.quote,
    };
    Ok(())
}

#[derive(Accounts)]
pub struct SetSellQuote<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(constraint = authority.key() == config.keeper || authority.key() == config.admin @ ScratchError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"quote", quote.stock_mint.as_ref()], bump = quote.bump)]
    pub quote: Account<'info, SellQuote>,
}

pub fn set_sell_quote(ctx: Context<SetSellQuote>, price_e8: u64, ts: i64) -> Result<()> {
    let q = &mut ctx.accounts.quote;
    let now = Clock::get()?.unix_timestamp;
    require!(price_e8 > 0, ScratchError::PriceOutOfBand);
    require!(ts > q.ts && ts <= now + 5, ScratchError::PriceStale);
    // Band against the previous quote unless it is old (market gap: the keeper walks feeds the same way).
    if now - q.ts < 3_600 {
        let (hi, lo) = (price_e8.max(q.price_e8) as u128, price_e8.min(q.price_e8) as u128);
        require!((hi - lo) * 10_000 <= q.price_e8 as u128 * QUOTE_MAX_MOVE_BPS, ScratchError::PriceOutOfBand);
    }
    q.price_e8 = price_e8;
    q.ts = ts;
    Ok(())
}

#[derive(Accounts)]
pub struct SellToVault<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"quote", stock_mint.key().as_ref()], bump = quote.bump)]
    pub quote: Account<'info, SellQuote>,
    pub stock_mint: Account<'info, Mint>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut, token::mint = stock_mint, token::authority = user)]
    pub user_stock: Account<'info, TokenAccount>,
    /// CHECK: the vault PDA (delegated to the rollup, so only its address is used, as in `pay_out`)
    #[account(seeds = [b"vault", stock_mint.key().as_ref()], bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(mut, associated_token::mint = stock_mint, associated_token::authority = vault)]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = config)]
    pub sell_pool: Account<'info, TokenAccount>,
    #[account(init_if_needed, payer = user, associated_token::mint = usdc_mint, associated_token::authority = user)]
    pub user_usdc: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn sell_to_vault(ctx: Context<SellToVault>, shares: u64, min_usdc_e6: u64) -> Result<()> {
    require!(shares > 0, ScratchError::InsufficientBalance);
    require!(!ctx.accounts.config.paused, ScratchError::Paused);
    let now = Clock::get()?.unix_timestamp;
    let (price, ts) = (ctx.accounts.quote.price_e8, ctx.accounts.quote.ts);
    require!(now - ts <= SELL_QUOTE_TTL_S, ScratchError::PriceStale);
    let usdc = usdc_for_sale(shares, price).ok_or(ScratchError::PriceOutOfBand)?;
    require!(usdc > 0 && usdc >= min_usdc_e6, ScratchError::SlippageExceeded);
    require!(ctx.accounts.sell_pool.amount >= usdc, ScratchError::InsufficientBalance);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.user_stock.to_account_info(),
                to: ctx.accounts.vault_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        shares,
    )?;
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.sell_pool.to_account_info(),
                to: ctx.accounts.user_usdc.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            &[&[b"config", &[ctx.accounts.config.bump]]],
        ),
        usdc,
    )?;
    let q = &mut ctx.accounts.quote;
    q.total_sold_shares = q.total_sold_shares.checked_add(shares).ok_or(ScratchError::InsufficientBalance)?;
    emit!(SoldToVault { user: ctx.accounts.user.key(), stock_mint: q.stock_mint, shares, usdc_e6: usdc, price_e8: price });
    Ok(())
}

#[derive(Accounts)]
pub struct AckSold<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(constraint = authority.key() == config.keeper || authority.key() == config.admin @ ScratchError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"quote", quote.stock_mint.as_ref()], bump = quote.bump)]
    pub quote: Account<'info, SellQuote>,
}

/// Keeper calls this *before* `sync_inventory` on the rollup, so a crash in between under-counts
/// inventory (safe) rather than double-counting it.
pub fn ack_sold(ctx: Context<AckSold>, total_synced: u64) -> Result<()> {
    let q = &mut ctx.accounts.quote;
    require!(total_synced >= q.synced_sold_shares && total_synced <= q.total_sold_shares, ScratchError::BadState);
    q.synced_sold_shares = total_synced;
    Ok(())
}
