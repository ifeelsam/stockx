//! claim_all (rollup) → commit + Magic Action → pay_out (base). Exactly-once via the `Payout` PDA.
use crate::{error::ScratchError, events::*, state::*};
use anchor_lang::prelude::*;
use anchor_lang::InstructionData;
use anchor_spl::{
    associated_token::get_associated_token_address,
    token::{self, Mint, Token, TokenAccount, Transfer},
};
use ephemeral_rollups_sdk::anchor::{action, commit};
use ephemeral_rollups_sdk::ephem::{CallHandler, FoldableIntentBuilder, MagicIntentBundleBuilder};
use ephemeral_rollups_sdk::pda::{delegation_record_pda_from_delegated_account, ephemeral_balance_pda_from_payer};
use ephemeral_rollups_sdk::{ActionArgs, ShortAccountMeta};

/// Each scheduled action is ~330 bytes of CPI data; keep the whole bundle well under the 10 KB CPI limit.
pub const MAX_CLAIM_BATCH: usize = 8;
pub const ACTION_ESCROW_INDEX: u8 = 255; // ActionArgs::new default

/// `MagicIntentBundleBuilder::build()` copies `is_signer` from the input AccountInfo. The Player PDA
/// is not a tx signer, so mark it; `build_and_invoke_signed` then provides the seeds that back it.
fn as_signer<'info>(a: AccountInfo<'info>) -> AccountInfo<'info> {
    AccountInfo { is_signer: true, ..a }
}

// ---- claim_all (rollup) ----------------------------------------------------------------------

#[commit]
#[derive(Accounts)]
#[instruction(series_id: u16)]
pub struct ClaimAll<'info> {
    /// Authority or its session key.
    #[account(mut)]
    pub signer: Signer<'info>,
    /// CHECK: Player owner; bound by the player PDA seeds
    pub authority: UncheckedAccount<'info>,
    /// Payer of its own commit, escrow authority of its actions, and the committed account.
    #[account(mut, seeds = [b"player", authority.key().as_ref()], bump)]
    pub player: AccountLoader<'info, Player>,
    #[account(seeds = [b"series", series_id.to_le_bytes().as_ref()], bump = series.bump)]
    pub series: Account<'info, Series>,
    #[account(mut, seeds = [b"vault", series.stock_mint.as_ref()], bump = vault_state.bump)]
    pub vault_state: Account<'info, VaultState>,
    /// CHECK: delegation record of the player; its validator derives `magic_fee_vault`
    #[account(address = delegation_record_pda_from_delegated_account(&player.key()))]
    pub delegation_record_player: UncheckedAccount<'info>,
    /// CHECK: checked against the PDA derived from the delegation record
    #[account(mut)]
    pub magic_fee_vault: UncheckedAccount<'info>,
}

/// Claims up to `MAX_CLAIM_BATCH` revealed cards of one series per call (call again for more).
/// Losing cards settle immediately; winners become `ClaimRequested` and get a post-commit pay_out.
pub fn claim_all(ctx: Context<ClaimAll>, series_id: u16) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let mint = ctx.accounts.series.stock_mint;
    let mut claims: Vec<(u64, u64)> = Vec::with_capacity(MAX_CLAIM_BATCH); // (card_id, shares)
    let bump;
    {
        let mut p = ctx.accounts.player.load_mut()?;
        p.authorize(&ctx.accounts.signer.key(), 0, now)?;
        bump = p.bump;
        for c in p.cards.iter_mut() {
            if c.state != CardState::Revealed as u8 || c.series != series_id {
                continue;
            }
            if c.shares == 0 {
                c.state = CardState::Settled as u8; // nothing to pay; slot is reusable
            } else if claims.len() < MAX_CLAIM_BATCH {
                c.state = CardState::ClaimRequested as u8;
                claims.push((c.id, c.shares));
            }
        }
    } // drop the borrow: the player AccountInfo is passed to CPIs below
    if claims.is_empty() {
        return Ok(());
    }

    let total: u64 = claims.iter().map(|c| c.1).sum();
    let vault = &mut ctx.accounts.vault_state;
    vault.reserved_shares = vault.reserved_shares.saturating_sub(total);
    vault.available_shares_mirror = vault.available_shares_mirror.checked_sub(total).ok_or(ScratchError::InsufficientInventory)?;

    // The magic fee vault belongs to the validator this player is delegated to.
    let validator = {
        let d = ctx.accounts.delegation_record_player.try_borrow_data()?;
        require!(d.len() >= 40, ScratchError::BadState);
        Pubkey::try_from(&d[8..40]).map_err(|_| error!(ScratchError::BadState))?
    };
    let (fee_vault, _) = Pubkey::find_program_address(&[b"magic-fee-vault", validator.as_ref()], &ephemeral_rollups_sdk::id());
    require_keys_eq!(ctx.accounts.magic_fee_vault.key(), fee_vault, ScratchError::BadState);

    let player_key = ctx.accounts.player.key();
    let authority_key = ctx.accounts.authority.key();
    let (series_key, vault_key) = (ctx.accounts.series.key(), ctx.accounts.vault_state.key());
    let vault_token = get_associated_token_address(&vault_key, &mint);
    let dest = get_associated_token_address(&authority_key, &mint);
    let player_ai = as_signer(ctx.accounts.player.to_account_info());
    let ro = |pubkey| ShortAccountMeta { pubkey, is_writable: false };
    let rw = |pubkey| ShortAccountMeta { pubkey, is_writable: true };

    let actions: Vec<CallHandler> = claims
        .iter()
        .map(|(card_id, _)| CallHandler {
            destination_program: crate::ID,
            // Order must match `PayOutAction`; the delegation program appends source_program, escrow_auth, escrow.
            accounts: vec![
                ro(player_key),
                ro(series_key),
                ro(vault_key),
                rw(vault_token),
                rw(dest),
                ro(mint),
                rw(Pubkey::find_program_address(&[b"payout", player_key.as_ref(), &card_id.to_le_bytes()], &crate::ID).0),
                ro(anchor_spl::token::ID),
                ro(anchor_lang::system_program::ID),
            ],
            args: ActionArgs::new(crate::instruction::PayOutAction { card_id: *card_id }.data()),
            escrow_authority: player_ai.clone(),
            compute_units: 200_000,
        })
        .collect();

    MagicIntentBundleBuilder::new(
        player_ai.clone(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .magic_fee_vault(ctx.accounts.magic_fee_vault.to_account_info())
    .commit(&[ctx.accounts.player.to_account_info()])
    .add_post_commit_actions(actions)
    .build_and_invoke_signed(&[&[b"player", authority_key.as_ref(), &[bump]]])?;

    emit!(ClaimRequested { player: player_key, series: series_id, cards: claims.len() as u8, shares: total });
    Ok(())
}

// ---- pay_out (base layer) --------------------------------------------------------------------

/// Pays one committed `ClaimRequested` card from the vault to the player's stock ATA, exactly once.
/// `player` is the committed snapshot: owned by us (undelegated) or the delegation program (delegated).
fn settle<'info>(
    player: &AccountInfo<'info>,
    series: &Series,
    vault_state: &AccountInfo<'info>,
    vault_token: &Account<'info, TokenAccount>,
    dest: &Account<'info, TokenAccount>,
    payout: &mut Account<'info, Payout>,
    token_program: &Program<'info, Token>,
    card_id: u64,
) -> Result<()> {
    require!(*player.owner == crate::ID || *player.owner == ephemeral_rollups_sdk::id(), ScratchError::BadState);
    // Read in place (a by-value Player copy would overflow the 4 KB BPF stack); copy out one card.
    let (authority, card) = {
        let d = player.try_borrow_data()?;
        let n = core::mem::size_of::<Player>();
        require!(d.len() >= 8 + n && d[..8] == *Player::DISCRIMINATOR, ScratchError::BadState);
        let p: &Player = bytemuck::try_from_bytes(&d[8..8 + n]).map_err(|_| error!(ScratchError::BadState))?;
        let expected = Pubkey::create_program_address(&[b"player", p.authority.as_ref(), &[p.bump]], &crate::ID)
            .map_err(|_| error!(ScratchError::BadState))?;
        require_keys_eq!(expected, player.key(), ScratchError::BadState);
        let card = *p
            .cards
            .iter()
            .find(|c| c.id == card_id && c.state == CardState::ClaimRequested as u8)
            .ok_or(ScratchError::BadState)?;
        (p.authority, card)
    };

    require!(payout.ts == 0, ScratchError::AlreadyPaid); // second pay_out fails here
    require!(card.series == series.id && card.shares > 0, ScratchError::BadState);
    require_keys_eq!(dest.owner, authority, ScratchError::BadState);

    payout.shares = card.shares;
    payout.ts = Clock::get()?.unix_timestamp;

    let (_, bump) = Pubkey::find_program_address(&[b"vault", series.stock_mint.as_ref()], &crate::ID);
    token::transfer(
        CpiContext::new_with_signer(
            token_program.key(),
            Transfer { from: vault_token.to_account_info(), to: dest.to_account_info(), authority: vault_state.clone() },
            &[&[b"vault", series.stock_mint.as_ref(), &[bump]]],
        ),
        card.shares,
    )?;
    emit!(PaidOut { player: player.key(), card_id, shares: card.shares });
    Ok(())
}

/// Magic Action target. Only reachable through the delegation program's post-commit path.
#[action]
#[derive(Accounts)]
#[instruction(card_id: u64)]
pub struct PayOutAction<'info> {
    /// CHECK: committed Player snapshot, parsed and PDA-verified in `settle`
    pub player: UncheckedAccount<'info>,
    pub series: Account<'info, Series>,
    /// CHECK: vault PDA (authority of vault_token)
    #[account(seeds = [b"vault", series.stock_mint.as_ref()], bump)]
    pub vault_state: UncheckedAccount<'info>,
    #[account(mut, associated_token::mint = stock_mint, associated_token::authority = vault_state)]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(mut, token::mint = stock_mint)]
    pub dest: Account<'info, TokenAccount>,
    #[account(address = series.stock_mint)]
    pub stock_mint: Account<'info, Mint>,
    #[account(
        init_if_needed, payer = escrow, space = 8 + Payout::INIT_SPACE,
        seeds = [b"payout", player.key().as_ref(), card_id.to_le_bytes().as_ref()], bump
    )]
    pub payout: Account<'info, Payout>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    /// CHECK: program that scheduled the action
    #[account(address = crate::ID @ ScratchError::Unauthorized)]
    pub source_program: UncheckedAccount<'info>,
    /// CHECK: the player PDA this program schedules its actions with
    #[account(address = player.key() @ ScratchError::Unauthorized)]
    pub escrow_auth: UncheckedAccount<'info>,
    /// CHECK: only the delegation program can sign for this PDA: proves the post-commit path
    #[account(
        mut, signer @ ScratchError::Unauthorized,
        address = ephemeral_balance_pda_from_payer(&escrow_auth.key(), ACTION_ESCROW_INDEX) @ ScratchError::Unauthorized,
    )]
    pub escrow: UncheckedAccount<'info>,
}

pub fn pay_out_action(ctx: Context<PayOutAction>, card_id: u64) -> Result<()> {
    let a = ctx.accounts;
    settle(&a.player.to_account_info(), &a.series, &a.vault_state.to_account_info(), &a.vault_token, &a.dest, &mut a.payout, &a.token_program, card_id)
}

/// Keeper repair path: same effect, authorised by the keeper key instead of the escrow signature.
#[derive(Accounts)]
#[instruction(card_id: u64)]
pub struct PayOut<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, address = config.keeper @ ScratchError::Unauthorized)]
    pub keeper: Signer<'info>,
    /// CHECK: committed Player snapshot, parsed and PDA-verified in `settle`
    pub player: UncheckedAccount<'info>,
    pub series: Account<'info, Series>,
    /// CHECK: vault PDA (authority of vault_token)
    #[account(seeds = [b"vault", series.stock_mint.as_ref()], bump)]
    pub vault_state: UncheckedAccount<'info>,
    #[account(mut, associated_token::mint = stock_mint, associated_token::authority = vault_state)]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(mut, token::mint = stock_mint)]
    pub dest: Account<'info, TokenAccount>,
    #[account(address = series.stock_mint)]
    pub stock_mint: Account<'info, Mint>,
    #[account(
        init_if_needed, payer = keeper, space = 8 + Payout::INIT_SPACE,
        seeds = [b"payout", player.key().as_ref(), card_id.to_le_bytes().as_ref()], bump
    )]
    pub payout: Account<'info, Payout>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn pay_out(ctx: Context<PayOut>, card_id: u64) -> Result<()> {
    let a = ctx.accounts;
    settle(&a.player.to_account_info(), &a.series, &a.vault_state.to_account_info(), &a.vault_token, &a.dest, &mut a.payout, &a.token_program, card_id)
}

// ---- mark_settled (rollup) -------------------------------------------------------------------

/// Anyone may call: it only succeeds with proof that the base-layer `Payout` exists for that card.
#[derive(Accounts)]
#[instruction(card_id: u64)]
pub struct MarkSettled<'info> {
    /// CHECK: Player owner; bound by the player PDA seeds
    pub authority: UncheckedAccount<'info>,
    #[account(mut, seeds = [b"player", authority.key().as_ref()], bump)]
    pub player: AccountLoader<'info, Player>,
    #[account(seeds = [b"payout", player.key().as_ref(), card_id.to_le_bytes().as_ref()], bump)]
    pub payout: Account<'info, Payout>,
}

pub fn mark_settled(ctx: Context<MarkSettled>, card_id: u64) -> Result<()> {
    let mut p = ctx.accounts.player.load_mut()?;
    let card = p
        .cards
        .iter_mut()
        .find(|c| c.id == card_id && c.state == CardState::ClaimRequested as u8)
        .ok_or(ScratchError::BadState)?;
    require!(card.shares == ctx.accounts.payout.shares, ScratchError::BadState);
    card.state = CardState::Settled as u8;
    Ok(())
}
