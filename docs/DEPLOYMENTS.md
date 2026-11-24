# Deployments (devnet)

| Date | What | Program / address | Slot / signature | Git SHA |
|---|---|---|---|---|
| 2026-11-24 | Program deploy #1 | `EQaiygfGRcn53N3EEMArDapzcw54iZL6UcuTpSPu2Ygn` (ProgramData `F9qKVXYKTz5csf9PjzV8SAVdux99PUMpYum2pDe3o2cH`, upgrade authority = deployer `Bo7dijSQzznSVmdy7jY622xrUdekfZgQyJU2dFcNbNvT`) | slot 525813302, tx `4zdGMQ3UVNWEU4UxamqS…` (truncated; full signature via `solana program show`/explorer) | `57c30cb` |
| 2026-11-24 | `setup:devnet` | mints, config, 3 feeds, 4 series, vaults, quotes, stats, delegation, rollup `sync_inventory`, Magic-ATA treasury | see `deployments/devnet.json` | `57c30cb` |

Rollup validator: `MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57` (devnet-as). Binary 739,912 bytes, rent 3.76 SOL.

Note: the sell pool (base-layer ATA of the Config PDA) and the USDC treasury (Magic ATA on the rollup) share one address by design; they are different accounts on different ledgers.
