# Draft for MagicBlock Blitz Telegram

Hi MagicBlock team — building "Stock Scratchers" for Blitz v10 (Entertainment Finance). We need real-time equity prices on the devnet rollup. The oracle feed list (`pyth_lazer_list.json`) has 125 crypto feeds and no TSLA/NVDA. Could you push Pyth Lazer **TSLA/USD** and **NVDA/USD** to the devnet ephemeral rollup oracle (and share the feed account addresses + exponents)? Until then we're running a self-pushed `PriceFeed` fallback (Hermes → our program) and will swap to your oracle when available. Thanks!
