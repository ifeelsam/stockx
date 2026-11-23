use anchor_lang::prelude::*;

#[event]
pub struct CardBought {
    pub player: Pubkey,
    pub card_id: u64,
    pub series: u16,
    pub locked_price: u64,
    pub request_id: [u8; 32],
}

#[event]
pub struct CardRevealed {
    pub player: Pubkey,
    pub card_id: u64,
    pub tier: u8,
    pub multiplier: u16,
    pub shares: u64,
    pub seed: [u8; 32],
}

#[event]
pub struct CardCancelled {
    pub player: Pubkey,
    pub card_id: u64,
    pub refund_e6: u64,
}

#[event]
pub struct PriceUpdated {
    pub feed_id: [u8; 32],
    pub price: i64,
    pub publish_ts: i64,
}
