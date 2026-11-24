use crate::{error::ScratchError, price::PriceSource};
use anchor_lang::prelude::*;

pub const MAX_CARDS: usize = 32;
pub const NUM_TIERS: usize = 8;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub keeper: Pubkey,
    pub usdc_mint: Pubkey,
    pub paused: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace, Debug, PartialEq)]
pub struct Tier {
    pub multiplier: u16,
    pub weight: u32,
}

#[account]
#[derive(InitSpace)]
pub struct Series {
    pub id: u16,
    pub stock_mint: Pubkey,
    pub price_source: PriceSource,
    pub feed: Pubkey,
    pub feed_expo: i32,
    pub ticket_usd_e6: u64,
    pub tiers: [Tier; NUM_TIERS],
    pub total_weight: u32,
    pub frozen: bool,
    pub demo: bool,
    pub max_staleness_s: i64,
    pub max_move_bps: u16,
    pub max_conf_bps: u16,
    pub vrf_timeout_s: i64,
    pub last_price: u64,
    pub bump: u8,
}

impl Series {
    /// Table must be non-empty and weights must sum to `total_weight`.
    pub fn validate_table(tiers: &[Tier; NUM_TIERS], total_weight: u32) -> Result<()> {
        let sum: u64 = tiers.iter().map(|t| t.weight as u64).sum();
        require!(total_weight > 0 && sum == total_weight as u64, ScratchError::BadPrizeTable);
        Ok(())
    }

    /// Public, recomputable: u64 from seed[0..8] (LE) mod total_weight → tier index.
    pub fn tier_for(&self, seed: &[u8; 32]) -> usize {
        let r = u64::from_le_bytes(seed[0..8].try_into().unwrap()) % self.total_weight as u64;
        let mut acc = 0u64;
        for (i, t) in self.tiers.iter().enumerate() {
            acc += t.weight as u64;
            if r < acc {
                return i;
            }
        }
        unreachable!("validate_table guarantees weights sum to total_weight")
    }

    /// Σ multiplier·weight (RTP numerator over total_weight).
    pub fn rtp_numerator(&self) -> u64 {
        self.tiers.iter().map(|t| t.multiplier as u64 * t.weight as u64).sum()
    }

    pub fn max_multiplier(&self) -> u16 {
        self.tiers.iter().filter(|t| t.weight > 0).map(|t| t.multiplier).max().unwrap_or(0)
    }
}

#[account]
#[derive(InitSpace)]
pub struct VaultState {
    pub stock_mint: Pubkey,
    pub usdc_in_e6: u64,
    pub reserved_shares: u64,
    pub available_shares_mirror: u64,
    pub bump: u8,
}

/// Base-layer (never delegated) sell quote for one stock mint, posted by the keeper. `sell_to_vault`
/// is a single atomic base-layer instruction, so it cannot read the delegated rollup feed.
#[account]
#[derive(InitSpace)]
pub struct SellQuote {
    pub stock_mint: Pubkey,
    /// USD per whole share, 1e8 fixed point (mid; the spread is applied at sale time)
    pub price_e8: u64,
    pub ts: i64,
    /// cumulative shares sold into the vault
    pub total_sold_shares: u64,
    /// part of `total_sold_shares` already credited to the rollup inventory mirror
    pub synced_sold_shares: u64,
    pub bump: u8,
}

/// Quotes older than this cannot be sold into.
pub const SELL_QUOTE_TTL_S: i64 = 90;
/// House spread on sells (basis points), so a stale-but-fresh-enough quote cannot be farmed.
pub const SELL_SPREAD_BPS: u128 = 50;
/// Max quote move per update when the previous quote is under an hour old.
pub const QUOTE_MAX_MOVE_BPS: u128 = 1_000;

/// USDC (1e-6) paid for `shares` (1e-6 units) at `price_e8`, minus the spread. Floors.
pub fn usdc_for_sale(shares: u64, price_e8: u64) -> Option<u64> {
    let gross = shares as u128 * price_e8 as u128 / 100_000_000u128;
    u64::try_from(gross * (10_000 - SELL_SPREAD_BPS) / 10_000).ok()
}

/// Exactly-once payout receipt; PDA ["payout", player, card_id].
#[account]
#[derive(InitSpace)]
pub struct Payout {
    pub shares: u64,
    pub ts: i64,
}

/// Stock mints use 6 decimals, so shares are in 1e-6 units.
pub const STOCK_DECIMALS: u8 = 6;

/// Path B price feed: pushed by `pusher` on the rollup (gasless).
#[account]
#[derive(InitSpace)]
pub struct PriceFeed {
    pub feed_id: [u8; 32],
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
    pub publish_ts: i64,
    pub pusher: Pubkey,
    pub max_move_bps: u16,
    pub bump: u8,
}

/// shares (1e-6 units) = multiplier × ticket_usd ÷ price. `price_e8`: USD per whole share, 1e8 fixed point.
/// Floors (house-favouring).
pub fn shares_for(multiplier: u16, ticket_usd_e6: u64, price_e8: u64) -> Option<u64> {
    if price_e8 == 0 {
        return None;
    }
    let n = multiplier as u128 * ticket_usd_e6 as u128 * 100_000_000u128; // 1e6 decimals · 1e8 price scale / 1e6 ticket scale
    u64::try_from(n / price_e8 as u128).ok()
}

#[cfg(test)]
mod sell_tests {
    use super::*;
    #[test]
    fn sale_math_applies_spread_and_floors() {
        // 1 share at $150 → $150 less 0.5%
        assert_eq!(usdc_for_sale(1_000_000, 150 * 100_000_000), Some(149_250_000));
        assert_eq!(usdc_for_sale(0, 1), Some(0));
        // buying then selling the same shares at the same price never makes money
        let shares = shares_for(1, 1_000_000, 248_31_000_000).unwrap();
        assert!(usdc_for_sale(shares, 248_31_000_000).unwrap() < 1_000_000);
    }
}

#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum CardState {
    Empty = 0,
    Paid = 1,
    RandomnessPending = 2,
    Revealed = 3,
    ClaimRequested = 4,
    Settled = 5,
    Cancelled = 6,
}

/// Lives inside `Player` (no temp rollup accounts). 112 bytes, no implicit padding.
#[zero_copy]
#[derive(Default)]
pub struct Card {
    pub id: u64,
    pub locked_price: u64,
    pub shares: u64,
    pub paid_ts: i64,
    pub revealed_ts: i64,
    pub vrf_request_id: [u8; 32],
    pub seed: [u8; 32],
    pub series: u16,
    pub state: u8,
    pub tier: u8,
    pub _pad: [u8; 4],
}

impl Card {
    pub fn is_free(&self) -> bool {
        self.state == CardState::Empty as u8
            || self.state == CardState::Settled as u8
            || self.state == CardState::Cancelled as u8
    }
}

/// Zero-copy: 3.5 KB would blow the 4 KB BPF stack as a borsh account.
#[account(zero_copy)]
pub struct Player {
    pub authority: Pubkey,
    pub session_key: Pubkey,
    pub usdc_balance_e6: u64,
    pub next_card_id: u64,
    pub session_expiry: i64,
    pub session_spend_remaining_e6: u64,
    pub cards: [Card; MAX_CARDS],
    pub bump: u8,
    pub _pad: [u8; 7],
}

impl Player {
    /// Authority signs directly; otherwise a live session key may spend up to its remaining cap.
    /// Session validity and the spend cap are enforced here (eSPL `approve` is not relied on).
    pub fn authorize(&mut self, signer: &Pubkey, cost: u64, now: i64) -> Result<()> {
        if *signer == self.authority {
            return Ok(());
        }
        require!(*signer == self.session_key && self.session_key != Pubkey::default(), ScratchError::Unauthorized);
        require!(now < self.session_expiry, ScratchError::SessionExpired);
        require!(self.session_spend_remaining_e6 >= cost, ScratchError::SessionCapExceeded);
        self.session_spend_remaining_e6 -= cost;
        Ok(())
    }

    /// Cards whose result is still owed by VRF or the base-layer payout; unsafe to undelegate over.
    pub fn has_inflight(&self) -> bool {
        self.cards.iter().any(|c| {
            c.state == CardState::Paid as u8
                || c.state == CardState::RandomnessPending as u8
                || c.state == CardState::ClaimRequested as u8
        })
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use bytemuck::Zeroable;

    #[test]
    fn shares_math() {
        // $1 ticket, $200/share, 1x = 0.005 share = 5000 base units
        assert_eq!(shares_for(1, 1_000_000, 200 * 100_000_000), Some(5_000));
        assert_eq!(shares_for(1000, 1_000_000, 200 * 100_000_000), Some(5_000_000));
        assert_eq!(shares_for(0, 1_000_000, 1), Some(0));
        assert_eq!(shares_for(1, 1_000_000, 0), None);
        // floors
        assert_eq!(shares_for(1, 1_000_000, 300 * 100_000_000), Some(3_333));
    }

    fn player_with_session(expiry: i64, cap: u64) -> (Player, Pubkey, Pubkey) {
        let mut p = Player::zeroed();
        let (auth, sess) = (Pubkey::new_unique(), Pubkey::new_unique());
        p.authority = auth;
        p.session_key = sess;
        p.session_expiry = expiry;
        p.session_spend_remaining_e6 = cap;
        (p, auth, sess)
    }

    #[test]
    fn session_rules() {
        let (mut p, auth, sess) = player_with_session(100, 5_000_000);
        p.authorize(&auth, u64::MAX, 1_000).unwrap(); // authority ignores session
        p.authorize(&sess, 2_000_000, 99).unwrap();
        assert_eq!(p.session_spend_remaining_e6, 3_000_000);
        assert!(p.authorize(&sess, 3_000_001, 99).is_err()); // cap exceeded
        p.authorize(&sess, 3_000_000, 99).unwrap(); // exhaust exactly
        assert!(p.authorize(&sess, 1, 99).is_err()); // cap exhausted
        assert!(p.authorize(&Pubkey::new_unique(), 0, 99).is_err()); // stranger

        let (mut expired, _, sess) = player_with_session(100, 5_000_000); // cap left but expired
        assert!(expired.authorize(&sess, 1, 100).is_err());
        let (mut nocap, _, sess) = player_with_session(100, 0); // valid but no cap
        assert!(nocap.authorize(&sess, 1, 50).is_err());
        nocap.authorize(&sess, 0, 50).unwrap();
    }

    pub fn default_series() -> Series {
        let w = [(0, 61_858), (1, 25_000), (2, 10_000), (5, 2_000), (10, 1_000), (50, 100), (100, 40), (1000, 2)];
        let mut tiers = [Tier::default(); NUM_TIERS];
        for (t, (m, wt)) in tiers.iter_mut().zip(w) {
            *t = Tier { multiplier: m, weight: wt };
        }
        Series {
            id: 0, stock_mint: Pubkey::default(), price_source: PriceSource::SelfPushed, feed: Pubkey::default(),
            feed_expo: -8, ticket_usd_e6: 1_000_000, tiers, total_weight: 100_000, frozen: false, demo: false,
            max_staleness_s: 30, max_move_bps: 500, max_conf_bps: 100, vrf_timeout_s: 300, last_price: 0, bump: 0,
        }
    }

    #[test]
    fn weights_sum_and_rtp_is_exactly_76_percent() {
        let s = default_series();
        Series::validate_table(&s.tiers, s.total_weight).unwrap();
        assert_eq!(s.rtp_numerator(), 76_000); // 76_000 / 100_000 = 76%
        assert_eq!(s.max_multiplier(), 1000);
    }

    #[test]
    fn bad_table_rejected() {
        let mut s = default_series();
        s.tiers[0].weight += 1;
        assert!(Series::validate_table(&s.tiers, s.total_weight).is_err());
    }

    fn seed_with(r: u64) -> [u8; 32] {
        let mut s = [0u8; 32];
        s[0..8].copy_from_slice(&r.to_le_bytes());
        s
    }

    #[test]
    fn tier_selection_boundaries() {
        let s = default_series();
        // cumulative: 61858 | 86858 | 96858 | 98858 | 99858 | 99958 | 99998 | 100000
        for (r, tier) in [(0, 0), (61_857, 0), (61_858, 1), (86_857, 1), (86_858, 2), (96_858, 3),
                          (98_858, 4), (99_858, 5), (99_958, 6), (99_997, 6), (99_998, 7), (99_999, 7),
                          (100_000, 0)] {
            assert_eq!(s.tier_for(&seed_with(r)), tier, "r={r}");
        }
    }

    #[test]
    fn player_fits_in_commit_limit() {
        assert_eq!(core::mem::size_of::<Card>(), 112);
        let size = 8 + core::mem::size_of::<Player>();
        assert!(size < 10_240, "Player is {size} bytes");
    }
}
