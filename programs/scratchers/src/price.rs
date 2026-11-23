use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum PriceSource {
    MagicBlockOracle,
    SelfPushed,
}

/// price: USD, 1e8 fixed point.
pub struct ValidatedPrice {
    pub price: u64,
    pub publish_ts: i64,
}
// read_price() lands in Day 2 (Path A + Path B).
