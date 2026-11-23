use crate::{error::ScratchError, state::*};
use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};

fn cfg(validator: Option<Pubkey>) -> DelegateConfig {
    DelegateConfig { validator, ..Default::default() }
}

// ---- Player (authority-signed) -------------------------------------------------------------

#[delegate]
#[derive(Accounts)]
pub struct DelegatePlayer<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: the Player PDA to delegate
    #[account(mut, del, seeds = [b"player", authority.key().as_ref()], bump)]
    pub player: UncheckedAccount<'info>,
}

pub fn delegate_player(ctx: Context<DelegatePlayer>, validator: Option<Pubkey>) -> Result<()> {
    ctx.accounts.delegate_player(
        &ctx.accounts.authority,
        &[b"player", ctx.accounts.authority.key().as_ref()],
        cfg(validator),
    )?;
    Ok(())
}

#[commit]
#[derive(Accounts)]
pub struct UndelegatePlayer<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"player", authority.key().as_ref()], bump)]
    pub player: AccountLoader<'info, Player>,
}

pub fn undelegate_player(ctx: Context<UndelegatePlayer>) -> Result<()> {
    // A pending VRF callback or payout needs the account on the rollup.
    require!(!ctx.accounts.player.load()?.has_inflight(), ScratchError::BadState);
    MagicIntentBundleBuilder::new(
        ctx.accounts.authority.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.player.to_account_info()])
    .build_and_invoke()?;
    Ok(())
}

// ---- VaultState (admin-signed) -------------------------------------------------------------

#[delegate]
#[derive(Accounts)]
pub struct DelegateVault<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ScratchError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: stock mint, only used for the PDA seed
    pub stock_mint: UncheckedAccount<'info>,
    /// CHECK: the VaultState PDA to delegate
    #[account(mut, del, seeds = [b"vault", stock_mint.key().as_ref()], bump)]
    pub vault_state: UncheckedAccount<'info>,
}

pub fn delegate_vault(ctx: Context<DelegateVault>, validator: Option<Pubkey>) -> Result<()> {
    ctx.accounts.delegate_vault_state(
        &ctx.accounts.admin,
        &[b"vault", ctx.accounts.stock_mint.key().as_ref()],
        cfg(validator),
    )?;
    Ok(())
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateVault<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ScratchError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut, seeds = [b"vault", vault_state.stock_mint.as_ref()], bump = vault_state.bump)]
    pub vault_state: Account<'info, VaultState>,
}

pub fn undelegate_vault(ctx: Context<UndelegateVault>) -> Result<()> {
    MagicIntentBundleBuilder::new(
        ctx.accounts.admin.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.vault_state.to_account_info()])
    .build_and_invoke()?;
    Ok(())
}

// ---- PriceFeed (admin-signed) --------------------------------------------------------------

#[delegate]
#[derive(Accounts)]
#[instruction(feed_id: [u8; 32])]
pub struct DelegateFeed<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ScratchError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: the PriceFeed PDA to delegate
    #[account(mut, del, seeds = [b"feed", feed_id.as_ref()], bump)]
    pub feed: UncheckedAccount<'info>,
}

pub fn delegate_feed(ctx: Context<DelegateFeed>, feed_id: [u8; 32], validator: Option<Pubkey>) -> Result<()> {
    ctx.accounts.delegate_feed(&ctx.accounts.admin, &[b"feed", feed_id.as_ref()], cfg(validator))?;
    Ok(())
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateFeed<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ScratchError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut, seeds = [b"feed", feed.feed_id.as_ref()], bump = feed.bump)]
    pub feed: Account<'info, PriceFeed>,
}

pub fn undelegate_feed(ctx: Context<UndelegateFeed>) -> Result<()> {
    MagicIntentBundleBuilder::new(
        ctx.accounts.admin.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.feed.to_account_info()])
    .build_and_invoke()?;
    Ok(())
}
