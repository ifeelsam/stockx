//! USDC in/out of the rollup. The user's eSPL balance is a plain SPL token account on the rollup;
//! the program holds funds in a treasury token account owned by the Config PDA, so it can sign
//! withdrawals itself. Spending inside the app is the `Player.usdc_balance_e6` ledger.
use crate::{error::ScratchError, state::*};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct Funds<'info> {
    /// Must be the Player owner: a session key can spend its cap on cards but never move funds.
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"player", authority.key().as_ref()], bump)]
    pub player: AccountLoader<'info, Player>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(address = config.usdc_mint, constraint = usdc_mint.decimals == 6 @ ScratchError::BadMint)]
    pub usdc_mint: Account<'info, Mint>,
    /// The user's eSPL balance (canonical ATA on the rollup).
    #[account(mut, token::mint = usdc_mint, token::authority = authority)]
    pub user_usdc: Account<'info, TokenAccount>,
    /// Program-held USDC (owned by the Config PDA).
    #[account(mut, token::mint = usdc_mint, token::authority = config)]
    pub treasury_usdc: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn deposit_usdc(ctx: Context<Funds>, amount: u64) -> Result<()> {
    require!(amount > 0, ScratchError::InsufficientBalance);
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.user_usdc.to_account_info(),
                to: ctx.accounts.treasury_usdc.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        amount,
    )?;
    let mut p = ctx.accounts.player.load_mut()?;
    p.usdc_balance_e6 = p.usdc_balance_e6.checked_add(amount).ok_or(ScratchError::InsufficientBalance)?;
    Ok(())
}

pub fn withdraw_usdc(ctx: Context<Funds>, amount: u64) -> Result<()> {
    require!(amount > 0, ScratchError::InsufficientBalance);
    {
        let mut p = ctx.accounts.player.load_mut()?;
        require!(p.usdc_balance_e6 >= amount, ScratchError::InsufficientBalance);
        p.usdc_balance_e6 -= amount;
    }
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.treasury_usdc.to_account_info(),
                to: ctx.accounts.user_usdc.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            &[&[b"config", &[ctx.accounts.config.bump]]],
        ),
        amount,
    )
}
