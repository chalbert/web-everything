---
bornAs: xsfplfp
kind: story
size: 2
parent: "2612"
status: open
scope: ["we:.github/workflows/ci.yml", "we:package.json"]
dateOpened: "2026-07-26"
tags: []
---

# Shard the full vitest run across CI runners

Shrink the ~2.0 min `test` gate by sharding the 2000+ vitest suite across N parallel CI runners
(`vitest run --shard=i/N`), with a fan-in that aggregates coverage. **Zero soundness risk, zero maintenance** —
every test still runs, just split across runners — so unlike scope-driven selection (#2681) it cannot produce a
false green. The design jury recommended landing this **before** the higher-risk diff-driven selection and then
re-justifying that lever against the measured post-shard wall-clock: sharding may already capture most of the
CI-duration tax, making the bespoke selection subsystem not worth its soundness cost.

## What to build

- A shard matrix in `we:.github/workflows/ci.yml`'s `test` job (`--shard=${{ matrix.shard }}/${{ N }}`), plus the
  coverage-merge step so the 80% bar (#2082) still gates on the combined result.
- Keep `check:standards` on its own (fast) — shard only the vitest run.
- Branch protection still requires the aggregated `test` result (and `smoke`), so the required-check contract is
  unchanged.

## Definition of done

- Full suite still runs in full; combined coverage still gates at 80%.
- Measured wall-clock cut recorded against the #2680 instrument, so #2681's marginal delta can be judged
  against *post-shard* numbers, not the pre-shard 2.0 min.
