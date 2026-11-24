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

/// MagicBlock pricing-oracle program (`PriCems…`). Feeds are `PriceUpdateV3` accounts owned by it.
pub const ORACLE_PROGRAM: Pubkey = pubkey!("PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd");
/// Anchor discriminator of the live oracle account (dumped from devnet-as, 2026-11-24).
const ORACLE_DISC: [u8; 8] = [0xea, 0xa1, 0x0e, 0x24, 0xac, 0xef, 0x0f, 0xe8];
/// Band only applies if the previous oracle read is this recent; otherwise it is a fresh baseline.
pub const BAND_WINDOW_S: i64 = 60;

/// The fields we use from the oracle account (Pyth `PriceUpdateV2`-compatible prefix).
#[derive(Debug, PartialEq)]
pub struct OracleReading {
    pub feed_id: [u8; 32],
    pub price: i64,
    pub publish_time: i64,
    pub posted_slot: u64,
}

/// Decodes the oracle account by its documented layout, ignoring trailing bytes. We do not use
/// `PriceUpdateV2::try_deserialize_unchecked`: the Pyth receiver crate pins anchor-lang 0.x, which
/// conflicts with this program's anchor-lang 1.x. Layout verified against a live ER account.
/// `[disc 8][write_authority 32][verification: 0=Partial(+1 byte) | 1=Full][feed_id 32][price i64]
///  [conf u64][exponent i32][publish_time i64][prev_publish_time i64][ema_price i64][ema_conf u64][posted_slot u64]`
pub fn decode_oracle(data: &[u8]) -> Option<OracleReading> {
    if data.len() < 8 || data[..8] != ORACLE_DISC {
        return None;
    }
    let mut o = 8 + 32;
    match *data.get(o)? {
        1 => o += 1, // Full. Partial is never accepted
        _ => return None,
    }
    let word = |at: usize, n: usize| data.get(at..at + n);
    let feed_id: [u8; 32] = word(o, 32)?.try_into().ok()?;
    o += 32;
    let price = i64::from_le_bytes(word(o, 8)?.try_into().ok()?);
    let publish_time = i64::from_le_bytes(word(o + 8 + 8 + 4, 8)?.try_into().ok()?);
    let posted_slot = u64::from_le_bytes(word(o + 8 + 8 + 4 + 8 + 8 + 8 + 8, 8)?.try_into().ok()?);
    Some(OracleReading { feed_id, price, publish_time, posted_slot })
}

/// Path A validation (pure). `conf` is deliberately unused: the oracle never writes it (always 0), and
/// the stored exponent is always +8, so the exponent comes from the series (the feed list).
pub fn validate_oracle(series: &Series, key: &Pubkey, owner: &Pubkey, data: &[u8], now: i64) -> Result<ValidatedPrice> {
    require_keys_eq!(*owner, ORACLE_PROGRAM, ScratchError::WrongFeed);
    let r = decode_oracle(data).ok_or(ScratchError::WrongFeed)?;
    require!(r.feed_id == key.to_bytes() && r.posted_slot > 0, ScratchError::WrongFeed);
    let price = scale_to_e8(r.price, series.feed_expo).ok_or(ScratchError::PriceOutOfBand)?;
    require!(r.publish_time <= now + 10, ScratchError::PriceOutOfBand); // future-dated
    require!(now.saturating_sub(r.publish_time) <= series.max_staleness_s, ScratchError::PriceStale);
    Ok(ValidatedPrice { price, publish_ts: r.publish_time })
}

/// Max-move band against the previous oracle read (the oracle gives no confidence to check).
pub fn within_band(prev_price: u64, prev_ts: i64, price: u64, now: i64, max_move_bps: u16) -> bool {
    if prev_price == 0 || now.saturating_sub(prev_ts) > BAND_WINDOW_S {
        return true;
    }
    let (hi, lo) = (price.max(prev_price) as u128, price.min(prev_price) as u128);
    (hi - lo) * 10_000 <= prev_price as u128 * max_move_bps as u128
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
        PriceSource::MagicBlockOracle => {
            let data = feed_ai.try_borrow_data()?;
            validate_oracle(series, &feed_ai.key(), feed_ai.owner, &data, clock.unix_timestamp)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::tests::default_series;

    fn feed(price: i64, conf: u64, ts: i64) -> PriceFeed {
        PriceFeed { feed_id: [0; 32], price, conf, expo: -8, publish_ts: ts, pusher: Pubkey::default(), max_move_bps: 500, bump: 0 }
    }

    /// Dumped from devnet-as `ENYwebBThHzmzwPLAQvCucUTsjyfBSZdD9ViXksS4jPu` (SOL/USD) on 2026-11-24.
    const LIVE_SOL_USD: &str = "eaa10e24acef0fe8000000000000000000000000000000000000000000000000000000000000000001c6ad3e841d9c0f248adff90cf776f839fd59f1cbd8ffbc8f9402883ea16e8420efff25a5010000000000000000000000080000004679056b000000004579056b0000000000000000000000000000000000000000332bd0440000000000";
    fn live() -> Vec<u8> {
        (0..LIVE_SOL_USD.len()).step_by(2).map(|i| u8::from_str_radix(&LIVE_SOL_USD[i..i + 2], 16).unwrap()).collect()
    }
    const SOL_FEED: Pubkey = pubkey!("ENYwebBThHzmzwPLAQvCucUTsjyfBSZdD9ViXksS4jPu");

    #[test]
    fn decodes_a_live_oracle_account() {
        let r = decode_oracle(&live()).unwrap();
        assert_eq!(r.feed_id, SOL_FEED.to_bytes(), "stored feed id is the account address");
        assert_eq!((r.price, r.publish_time, r.posted_slot), (7_065_698_287, 1_795_520_838, 1_154_493_235));
        // truncated / wrong discriminator / Partial verification are all rejected
        assert!(decode_oracle(&live()[..60]).is_none());
        let mut bad = live();
        bad[0] ^= 1;
        assert!(decode_oracle(&bad).is_none());
        let mut partial = live();
        partial[40] = 0;
        assert!(decode_oracle(&partial).is_none());
    }

    #[test]
    fn oracle_validation_uses_series_exponent_owner_feed_and_freshness() {
        let mut s = default_series();
        s.feed_expo = -8; // the account stores +8 (wrong); the feed list says -8
        s.max_staleness_s = 30;
        let (now, d) = (1_795_520_840, live());
        let p = validate_oracle(&s, &SOL_FEED, &ORACLE_PROGRAM, &d, now).unwrap();
        assert_eq!(p.price, 7_065_698_287, "$70.66 at 1e8, not 1 lamport-style garbage from the +8 exponent");
        // wrong owner / wrong feed address / stale / future-dated
        assert!(validate_oracle(&s, &SOL_FEED, &crate::ID, &d, now).is_err());
        assert!(validate_oracle(&s, &Pubkey::new_unique(), &ORACLE_PROGRAM, &d, now).is_err());
        assert!(validate_oracle(&s, &SOL_FEED, &ORACLE_PROGRAM, &d, now + 31).is_err());
        assert!(validate_oracle(&s, &SOL_FEED, &ORACLE_PROGRAM, &d, now - 20).is_err());
        // zero price (an uninitialised placeholder) is rejected
        let mut zero = live();
        zero[8 + 32 + 1 + 32..8 + 32 + 1 + 32 + 8].copy_from_slice(&0i64.to_le_bytes());
        assert!(validate_oracle(&s, &SOL_FEED, &ORACLE_PROGRAM, &zero, now).is_err());
        // posted_slot == 0 (initialisation placeholder) is rejected
        let mut unposted = live();
        let at = 8 + 32 + 1 + 32 + 8 + 8 + 4 + 8 + 8 + 8 + 8;
        unposted[at..at + 8].copy_from_slice(&0u64.to_le_bytes());
        assert!(validate_oracle(&s, &SOL_FEED, &ORACLE_PROGRAM, &unposted, now).is_err());
    }

    #[test]
    fn band_applies_only_to_recent_baselines() {
        assert!(within_band(0, 0, 999, 100, 500), "no baseline yet");
        assert!(within_band(100, 100, 105, 110, 500), "+5% on the edge");
        assert!(!within_band(100, 100, 106, 110, 500), "+6%");
        assert!(!within_band(100, 100, 94, 110, 500), "-6%");
        assert!(within_band(100, 100, 150, 100 + BAND_WINDOW_S + 1, 500), "old baseline is reset, not a wedge");
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
