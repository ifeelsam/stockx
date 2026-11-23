use crate::{error::ScratchError, events::PriceUpdated, state::*};
use anchor_lang::prelude::*;

/// Base layer, admin.
#[derive(Accounts)]
#[instruction(feed_id: [u8; 32])]
pub struct InitFeed<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ScratchError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(init, payer = admin, space = 8 + PriceFeed::INIT_SPACE, seeds = [b"feed", feed_id.as_ref()], bump)]
    pub feed: Account<'info, PriceFeed>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn init_feed(ctx: Context<InitFeed>, feed_id: [u8; 32], pusher: Pubkey, expo: i32, max_move_bps: u16) -> Result<()> {
    *ctx.accounts.feed = PriceFeed {
        feed_id, price: 0, conf: 0, expo, publish_ts: 0, pusher, max_move_bps, bump: ctx.bumps.feed,
    };
    Ok(())
}

/// Rollup (gasless). Only `feed.pusher` may sign.
#[derive(Accounts)]
pub struct PushPrice<'info> {
    pub pusher: Signer<'info>,
    #[account(mut, has_one = pusher @ ScratchError::Unauthorized)]
    pub feed: Account<'info, PriceFeed>,
}

pub fn push_price(ctx: Context<PushPrice>, price: i64, conf: u64, publish_ts: i64) -> Result<()> {
    let f = &mut ctx.accounts.feed;
    require!(price > 0, ScratchError::PriceOutOfBand);
    require!(publish_ts > f.publish_ts, ScratchError::PriceStale); // non-increasing ts rejected
    if f.price > 0 {
        let (old, new) = (f.price as u128, price as u128);
        require!(old.abs_diff(new) * 10_000 <= old * f.max_move_bps as u128, ScratchError::PriceOutOfBand);
    }
    f.price = price;
    f.conf = conf;
    f.publish_ts = publish_ts;
    emit!(PriceUpdated { feed_id: f.feed_id, price, publish_ts });
    Ok(())
}
