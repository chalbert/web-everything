---
bornAs: xsouh7c
kind: story
size: 3
status: open
scope: ["we:.github/workflows/ci.yml"]
dateOpened: "2026-08-26"
tags: []
---

# Take check:standards and shard imbalance off the per-PR CI critical path

Measured over four `we:.github/workflows/ci.yml` runs, the required-check critical path is ~6.2min: slowest vitest shard ~4.6min plus the needs:test-shard aggregator ~1.6min. check:standards has no shard dependency and sits behind them only by job co-location, and shard 4 runs 3.2x shard 2. Split check:standards into its own parallel job and rebalance the shards. Independent of the batch-gate decision 3347.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
