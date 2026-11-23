use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod price;
pub mod state;

use instructions::*;

declare_id!("EQaiygfGRcn53N3EEMArDapzcw54iZL6UcuTpSPu2Ygn");

#[program]
pub mod scratchers {
    use super::*;

    pub fn init_config(ctx: Context<InitConfig>, keeper: Pubkey, usdc_mint: Pubkey) -> Result<()> {
        instructions::init_config(ctx, keeper, usdc_mint)
    }
    pub fn create_series(ctx: Context<CreateSeries>, args: CreateSeriesArgs) -> Result<()> {
        instructions::create_series(ctx, args)
    }
    pub fn freeze_series(ctx: Context<FreezeSeries>) -> Result<()> {
        instructions::freeze_series(ctx)
    }
    pub fn init_vault(ctx: Context<InitVault>) -> Result<()> {
        instructions::init_vault(ctx)
    }
}

// getrandom 0.3 has no SBF backend; rand is a transitive dep that is never called on-chain.
// Needs RUSTFLAGS='--cfg getrandom_backend="custom"' (set in .cargo/config.toml).
#[cfg(target_os = "solana")]
#[no_mangle]
unsafe extern "Rust" fn __getrandom_v03_custom(_dest: *mut u8, _len: usize) -> core::result::Result<(), getrandom::Error> {
    core::result::Result::Err(getrandom::Error::UNSUPPORTED)
}
