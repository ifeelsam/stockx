use crate::{error::ScratchError, state::*};
use anchor_lang::prelude::*;

/// Base layer. Creates the Player PDA (stock ATAs are created per mint by the client).
#[derive(Accounts)]
pub struct Signup<'info> {
    #[account(
        init, payer = authority, space = 8 + core::mem::size_of::<Player>(),
        seeds = [b"player", authority.key().as_ref()], bump
    )]
    pub player: AccountLoader<'info, Player>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Lamports the Player PDA keeps above rent on the rollup: it is the payer of its own commits,
/// and `magic_fee_vault` charges from the 26th commit on.
pub const PLAYER_FEE_RESERVE: u64 = 10_000_000;

pub fn signup(ctx: Context<Signup>) -> Result<()> {
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.key(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.player.to_account_info(),
            },
        ),
        PLAYER_FEE_RESERVE,
    )?;
    let mut p = ctx.accounts.player.load_init()?;
    p.authority = ctx.accounts.authority.key();
    p.bump = ctx.bumps.player;
    Ok(())
}

/// Rollup. Only the authority sets or revokes the session.
#[derive(Accounts)]
pub struct Session<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"player", authority.key().as_ref()], bump)]
    pub player: AccountLoader<'info, Player>,
}

pub fn create_session(ctx: Context<Session>, session_key: Pubkey, expiry: i64, cap_e6: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(expiry > now, ScratchError::SessionExpired);
    let mut p = ctx.accounts.player.load_mut()?;
    p.session_key = session_key;
    p.session_expiry = expiry;
    p.session_spend_remaining_e6 = cap_e6;
    Ok(())
}

pub fn revoke_session(ctx: Context<Session>) -> Result<()> {
    let mut p = ctx.accounts.player.load_mut()?;
    p.session_key = Pubkey::default();
    p.session_expiry = 0;
    p.session_spend_remaining_e6 = 0;
    Ok(())
}
