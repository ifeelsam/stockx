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

#[cfg(test)]
mod tests {
    use super::*;

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
