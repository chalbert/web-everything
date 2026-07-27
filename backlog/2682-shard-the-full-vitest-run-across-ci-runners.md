---
bornAs: xsfplfp
kind: story
size: 2
parent: "2612"
status: resolved
scope: ["we:.github/workflows/ci.yml", "we:package.json", "we:scripts/merge-coverage.mjs", "we:scripts/__tests__/merge-coverage.test.mjs"]
dateOpened: "2026-07-26"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
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

## Progress

Delivered. The `test` job split into a `test-shard` matrix (4 shards) + a `test` aggregator that fans the
partial coverage back in and applies the 80% bar (#2082) to the combined result.

- **we:.github/workflows/ci.yml** — new `test-shard` matrix (`shard: [1,2,3,4]`, `fail-fast: false`) runs
  `vitest --shard=i/N` with per-shard coverage thresholds disabled (`test:coverage:shard`), uploading each
  shard's coverage JSON. The aggregator `test` job (unchanged required-check name) downloads all shards,
  merges + enforces 80%, and runs `check:standards` (unsharded). It runs with `if: !cancelled()` and fails
  unless every shard succeeded, so a failed shard surfaces as a real red `test` (never a skipped check that
  branch protection could misread as satisfied). Divisor = `strategy.job-total` (auto-tracks the matrix
  length); `--expect=4` guards a silently-dropped shard.
- **we:package.json** — `test:coverage:shard` (coverage + json reporter, thresholds disabled) and
  `coverage:merge` scripts.
- **we:scripts/merge-coverage.mjs** (+ we:scripts/__tests__/merge-coverage.test.mjs) — merges shard coverage
  via `istanbul-lib-coverage` (already a transitive dep). vitest 1.6.x predates the blob-reporter /
  `--merge-reports` merge path, so a bespoke merge was required rather than a vitest major upgrade — which is
  out of scope and would touch the lockfile.

**Soundness verified against a full unsharded run:** lines/statements/functions are byte-identical
(17092/17965, 658/697); branches wobble ~0.5pp (merged 86.46% vs full 85.91%) — an inherent artifact of
sharded v8 coverage (per-run branch-AST detection unioned by istanbul merge; vitest 2.x's native merge does
the same), biased slightly high and far from the 80% margin, so no false-green risk. Every test still runs.

**Wall-clock:** measured shard durations ~24-67s each vs the pre-shard ~2min full run; the post-shard `test`
check duration is directly observable on this PR's own CI for the #2680 / #2681 comparison.
