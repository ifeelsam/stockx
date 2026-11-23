use crate::{error::ScratchError, state::*};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum PriceSource {
    MagicBlockOracle,
    SelfPushed,
}

/// price: USD per whole share, 1e8 fixed point.
pub struct ValidatedPrice {
    pub price: u64,
    pub publish_ts: i64,
}

/// Rescale `price × 10^expo` to 1e8 fixed point.
pub fn scale_to_e8(price: i64, expo: i32) -> Option<u64> {
    let p = u64::try_from(price).ok().filter(|p| *p > 0)?;
    let shift = 8i32.checked_add(expo)?;
    if shift >= 0 {
        p.checked_mul(10u64.checked_pow(shift as u32)?)
    } else {
        Some(p / 10u64.checked_pow(shift.unsigned_abs())?)
    }
}

/// Path B validation (pure, unit-tested): confidence, freshness, scale.
pub fn validate_pushed(series: &Series, feed: &PriceFeed, now: i64) -> Result<ValidatedPrice> {
    let price = scale_to_e8(feed.price, feed.expo).ok_or(ScratchError::PriceOutOfBand)?;
    // conf / price <= max_conf_bps / 10_000
    require!(
        (feed.conf as u128) * 10_000 <= (feed.price as u128) * series.max_conf_bps as u128,
        ScratchError::PriceOutOfBand
    );
    require!(now.saturating_sub(feed.publish_ts) <= series.max_staleness_s, ScratchError::PriceStale);
    Ok(ValidatedPrice { price, publish_ts: feed.publish_ts })
}

/// Reads and validates the series' price feed. Same interface for both sources.
pub fn read_price(series: &Series, feed_ai: &AccountInfo, clock: &Clock) -> Result<ValidatedPrice> {
    require_keys_eq!(feed_ai.key(), series.feed, ScratchError::WrongFeed);
    match series.price_source {
        PriceSource::SelfPushed => {
            require_keys_eq!(*feed_ai.owner, crate::ID, ScratchError::WrongFeed);
            let feed = PriceFeed::try_deserialize(&mut &feed_ai.try_borrow_data()?[..])?;
            validate_pushed(series, &feed, clock.unix_timestamp)
        }
        // Path A (MagicBlock oracle) lands with Day 2 price work.
        PriceSource::MagicBlockOracle => err!(ScratchError::WrongFeed),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::tests::default_series;

    fn feed(price: i64, conf: u64, ts: i64) -> PriceFeed {
        PriceFeed { feed_id: [0; 32], price, conf, expo: -8, publish_ts: ts, pusher: Pubkey::default(), max_move_bps: 500, bump: 0 }
    }

    #[test]
    fn scaling() {
        assert_eq!(scale_to_e8(200_00000000, -8), Some(200_00000000));
        assert_eq!(scale_to_e8(20000, -2), Some(200_00000000)); // $200.00 as expo -2
        assert_eq!(scale_to_e8(2, 0), Some(200_000_000));
        assert_eq!(scale_to_e8(0, -8), None);
        assert_eq!(scale_to_e8(-5, -8), None);
    }

    #[test]
    fn freshness_and_confidence() {
        let s = default_series(); // max_staleness 30s, max_conf 100 bps
        let p = 200_00000000;
        assert!(validate_pushed(&s, &feed(p, 0, 1000), 1030).is_ok()); // exactly at limit
        assert!(validate_pushed(&s, &feed(p, 0, 1000), 1031).is_err()); // stale
        assert!(validate_pushed(&s, &feed(p, p as u64 / 100, 1000), 1000).is_ok()); // conf = 100 bps
        assert!(validate_pushed(&s, &feed(p, p as u64 / 100 + 1, 1000), 1000).is_err()); // too wide
    }
}
