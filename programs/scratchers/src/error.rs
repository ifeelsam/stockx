use anchor_lang::prelude::*;

#[error_code]
pub enum ScratchError {
    Paused,
    SeriesNotFrozen,
    PriceStale,
    PriceOutOfBand,
    PriceAboveMax,
    WrongFeed,
    InsufficientBalance,
    SessionExpired,
    SessionCapExceeded,
    NoFreeSlot,
    InsufficientInventory,
    VrfRequestMismatch,
    AlreadyRevealed,
    NotTimedOut,
    AlreadyPaid,
    BadState,
    // admin / config validation
    Unauthorized,
    SeriesFrozen,
    BadPrizeTable,
}
