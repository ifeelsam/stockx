use crate::{error::ScratchError, events::*, price::{read_price, within_band, PriceSource}, state::*};
use anchor_lang::prelude::*;
use solana_sha256_hasher::hashv;
use ephemeral_rollups_sdk::anchor::{vrf, vrf_callback};
use ephemeral_rollups_sdk::vrf::{
    consts::{program_identity_pubkey, scoped_vrf_identity_const, DEFAULT_EPHEMERAL_QUEUE, DEFAULT_EPHEMERAL_TEST_QUEUE},
    instructions::{create_request_randomness_ix_const, RequestRandomnessParams},
    types::SerializableAccountMeta,
};

const PROGRAM_IDENTITY: Pubkey = program_identity_pubkey(&crate::ID);
// Scoped VRF identity as a compile-time constant. The `#[vrf_callback]` macro's own check derives
// this PDA at runtime (curve check) and burns the whole 197k CU callback budget.
const VRF_IDENTITY: Pubkey = Pubkey::new_from_array(scoped_vrf_identity_const(&crate::ID).0);
pub const MAX_BUY: usize = 10;

fn is_oracle_queue(k: &Pubkey) -> bool {
    *k == DEFAULT_EPHEMERAL_QUEUE || (cfg!(feature = "localnet") && *k == DEFAULT_EPHEMERAL_TEST_QUEUE)
}

#[vrf]
#[derive(Accounts)]
pub struct BuyCard<'info> {
    /// Authority or its session key.
    #[account(mut)]
    pub signer: Signer<'info>,
    /// CHECK: Player owner; bound by the player PDA seeds
    pub authority: UncheckedAccount<'info>,
    #[account(mut, seeds = [b"player", authority.key().as_ref()], bump)]
    pub player: AccountLoader<'info, Player>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [b"series", series.id.to_le_bytes().as_ref()], bump = series.bump)]
    pub series: Account<'info, Series>,
    #[account(mut, seeds = [b"vault", series.stock_mint.as_ref()], bump = vault_state.bump)]
    pub vault_state: Account<'info, VaultState>,
    /// CHECK: validated by `read_price` (address, owner, freshness, confidence)
    pub price_feed: UncheckedAccount<'info>,
    /// CHECK: must be the delegated ephemeral VRF queue
    #[account(mut, constraint = is_oracle_queue(&oracle_queue.key()) @ ScratchError::BadState)]
    pub oracle_queue: UncheckedAccount<'info>,
}

pub fn buy_card(ctx: Context<BuyCard>, n: u8, max_price: u64, caller_seed: [u8; 32]) -> Result<()> {
    let n = n as usize;
    require!((1..=MAX_BUY).contains(&n), ScratchError::NoFreeSlot);
    let clock = Clock::get()?;
    let (cfg, s) = (&ctx.accounts.config, &ctx.accounts.series);
    require!(!cfg.paused, ScratchError::Paused);
    require!(s.frozen, ScratchError::SeriesNotFrozen);

    let price = read_price(s, &ctx.accounts.price_feed.to_account_info(), &clock)?;
    require!(price.price <= max_price, ScratchError::PriceAboveMax);

    let cost = s.ticket_usd_e6.checked_mul(n as u64).ok_or(ScratchError::InsufficientBalance)?;
    // Worst case liability per card at the locked price; held until the callback reveals the tier.
    let reserve = shares_for(s.max_multiplier(), s.ticket_usd_e6, price.price).ok_or(ScratchError::PriceOutOfBand)?;
    let reserve_total = reserve.checked_mul(n as u64).ok_or(ScratchError::InsufficientInventory)?;

    let vault = &mut ctx.accounts.vault_state;
    if s.price_source == PriceSource::MagicBlockOracle {
        // The oracle reports no confidence (conf == 0), so bound the move against the last read instead.
        require!(
            within_band(vault.last_oracle_price, vault.last_oracle_ts, price.price, clock.unix_timestamp, s.max_move_bps),
            ScratchError::PriceOutOfBand
        );
        vault.last_oracle_price = price.price;
        vault.last_oracle_ts = clock.unix_timestamp;
    }
    require!(
        vault.available_shares_mirror.saturating_sub(vault.reserved_shares) >= reserve_total,
        ScratchError::InsufficientInventory
    );

    let player_key = ctx.accounts.player.key();
    let series_id = s.id;
    let mut reqs: Vec<(u64, [u8; 32])> = Vec::with_capacity(n);
    {
        let mut p = ctx.accounts.player.load_mut()?;
        p.authorize(&ctx.accounts.signer.key(), cost, clock.unix_timestamp)?;
        require!(p.usdc_balance_e6 >= cost, ScratchError::InsufficientBalance);

        let free: Vec<usize> = p.cards.iter().enumerate().filter(|(_, c)| c.is_free()).map(|(i, _)| i).take(n).collect();
        require!(free.len() == n, ScratchError::NoFreeSlot);

        p.usdc_balance_e6 -= cost;
        vault.usdc_in_e6 = vault.usdc_in_e6.checked_add(cost).ok_or(ScratchError::InsufficientBalance)?;
        vault.reserved_shares += reserve_total;

        for (i, slot) in free.into_iter().enumerate() {
            let id = p.next_card_id;
            p.next_card_id += 1;
            // Unique per card (ids never repeat); binds one callback to one request.
            let request_id = hashv(&[player_key.as_ref(), &id.to_le_bytes(), &caller_seed, &[i as u8][..]]).to_bytes();
            p.cards[slot] = Card {
                id,
                locked_price: price.price,
                shares: reserve,
                paid_ts: clock.unix_timestamp,
                vrf_request_id: request_id,
                series: series_id,
                state: CardState::RandomnessPending as u8,
                ..Default::default()
            };
            reqs.push((id, request_id));
            emit!(CardBought { player: player_key, card_id: id, series: series_id, locked_price: price.price, request_id });
        }
    }

    for (i, (id, request_id)) in reqs.into_iter().enumerate() {
        let mut args = Vec::with_capacity(40);
        args.extend_from_slice(&id.to_le_bytes());
        args.extend_from_slice(&request_id);
        let per_card_seed = hashv(&[&caller_seed[..], &[i as u8][..]]).to_bytes(); // client entropy, distinct per card
        let ix = create_request_randomness_ix_const(
            RequestRandomnessParams {
                payer: ctx.accounts.signer.key(),
                oracle_queue: ctx.accounts.oracle_queue.key(),
                callback_program_id: crate::ID,
                callback_discriminator: crate::instruction::VrfCallback::DISCRIMINATOR.to_vec(),
                caller_seed: per_card_seed,
                accounts_metas: Some(vec![
                    SerializableAccountMeta { pubkey: player_key, is_signer: false, is_writable: true },
                    SerializableAccountMeta { pubkey: ctx.accounts.series.key(), is_signer: false, is_writable: false },
                    SerializableAccountMeta { pubkey: ctx.accounts.vault_state.key(), is_signer: false, is_writable: true },
                ]),
                callback_args: Some(args),
            },
            PROGRAM_IDENTITY,
        );
        ctx.accounts.invoke_signed_vrf(&ctx.accounts.signer.to_account_info(), &ix)?;
    }
    Ok(())
}

/// Only callbacks signed by this program's scoped VRF identity reach here.
#[vrf_callback]
#[derive(Accounts)]
pub struct VrfCallback<'info> {
    /// Signer proves the callback was issued by the VRF program for this program.
    #[account(address = VRF_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut)]
    pub player: AccountLoader<'info, Player>,
    pub series: Account<'info, Series>,
    #[account(mut, seeds = [b"vault", series.stock_mint.as_ref()], bump = vault_state.bump)]
    pub vault_state: Account<'info, VaultState>,
}

pub fn vrf_callback(ctx: Context<VrfCallback>, randomness: [u8; 32], card_id: u64, request_id: [u8; 32]) -> Result<()> {
    let s = &ctx.accounts.series;
    let mut p = ctx.accounts.player.load_mut()?;
    // A cancelled/reused slot no longer carries this id + request id, so late callbacks land here.
    let card = p
        .cards
        .iter_mut()
        .find(|c| c.id == card_id && c.vrf_request_id == request_id && c.state != CardState::Empty as u8)
        .ok_or(ScratchError::VrfRequestMismatch)?;
    require!(card.state == CardState::RandomnessPending as u8, ScratchError::AlreadyRevealed);
    require!(card.series == s.id, ScratchError::BadState);

    let tier = s.tier_for(&randomness);
    let multiplier = s.tiers[tier].multiplier;
    let actual = shares_for(multiplier, s.ticket_usd_e6, card.locked_price).ok_or(ScratchError::PriceOutOfBand)?;
    let release = card.shares.checked_sub(actual).ok_or(ScratchError::BadState)?;

    let vault = &mut ctx.accounts.vault_state;
    vault.reserved_shares = vault.reserved_shares.saturating_sub(release);

    card.seed = randomness;
    card.tier = tier as u8;
    card.shares = actual;
    card.revealed_ts = Clock::get()?.unix_timestamp;
    card.state = CardState::Revealed as u8;
    emit!(CardRevealed { player: ctx.accounts.player.key(), card_id, tier: tier as u8, multiplier, shares: actual, seed: randomness });
    Ok(())
}

#[derive(Accounts)]
pub struct CancelPending<'info> {
    pub signer: Signer<'info>,
    /// CHECK: Player owner; bound by the player PDA seeds
    pub authority: UncheckedAccount<'info>,
    #[account(mut, seeds = [b"player", authority.key().as_ref()], bump)]
    pub player: AccountLoader<'info, Player>,
    #[account(seeds = [b"series", series.id.to_le_bytes().as_ref()], bump = series.bump)]
    pub series: Account<'info, Series>,
    #[account(mut, seeds = [b"vault", series.stock_mint.as_ref()], bump = vault_state.bump)]
    pub vault_state: Account<'info, VaultState>,
}

/// After `vrf_timeout_s`: refund, release the reservation, void the request id so a late callback is rejected.
pub fn cancel_pending(ctx: Context<CancelPending>, card_id: u64) -> Result<()> {
    let s = &ctx.accounts.series;
    let now = Clock::get()?.unix_timestamp;
    let mut p = ctx.accounts.player.load_mut()?;
    p.authorize(&ctx.accounts.signer.key(), 0, now)?;
    let card = p
        .cards
        .iter_mut()
        .find(|c| c.id == card_id && c.state == CardState::RandomnessPending as u8)
        .ok_or(ScratchError::BadState)?;
    require!(card.series == s.id, ScratchError::BadState);
    require!(now - card.paid_ts >= s.vrf_timeout_s, ScratchError::NotTimedOut);

    let reserved = card.shares;
    card.vrf_request_id = [0; 32];
    card.shares = 0;
    card.state = CardState::Cancelled as u8;
    p.usdc_balance_e6 += s.ticket_usd_e6;

    let vault = &mut ctx.accounts.vault_state;
    vault.reserved_shares = vault.reserved_shares.saturating_sub(reserved);
    vault.usdc_in_e6 = vault.usdc_in_e6.saturating_sub(s.ticket_usd_e6);
    emit!(CardCancelled { player: ctx.accounts.player.key(), card_id, refund_e6: s.ticket_usd_e6 });
    Ok(())
}
