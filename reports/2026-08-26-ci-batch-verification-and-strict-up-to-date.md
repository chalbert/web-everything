# Batch verification vs strict up-to-date — measuring what the drain's rebase storm actually costs

**Date:** 2026-08-26 · **Grounds:** decision `#xbi8dmf` · **Related:** #2138 (deferred merge queue), #2153 (PR transport)

## The reported problem

`main`'s branch protection requires branches be up to date. Every queued `lane/*` PR therefore flips to
`BEHIND` the instant another lands, `we:scripts/merge-ai-prs.mjs:586` refuses it as un-landable, the
rebase-drop path at `we:scripts/merge-ai-prs.mjs:609` rebuilds its tip, and the required checks re-run.
For a queue of N couples that is N serial CI rounds, most of them re-testing lanes that never touched a
common file.

## Measured — branch protection

`gh api repos/chalbert/web-everything/branches/main/protection` (2026-08-26):

```json
{ "contexts": ["test", "smoke"], "strict": true }
```

`strict: true` is what marks a PR `BEHIND` on a base advance.

**Correction (skeptic pass).** An earlier draft of this report claimed `strict` was an unexamined default
not recorded in any ruling. **That is false, and the source refutes it.** #2152 configures it deliberately
and records it in three places: its digest lists *"require branches up-to-date before merge"* as one of the
three things to set, its result block records *"`strict: true` (branches up-to-date before merge)"*, and its
verify command reads `strict` first. Flipping it is therefore a **reversal of a ruled setting**, not the
tidying-up of an oversight — which raises the bar on anything proposing to flip it.

## Measured — where the per-PR minutes actually go

Per-job durations, four consecutive successful `we:.github/workflows/ci.yml` runs (`33013753985`,
`33013745174`, `33013540518`, `33013487865`):

| job | run 1 | run 2 | run 3 | run 4 | on critical path? |
|---|---|---|---|---|---|
| `test-shard (4)` | 276s | 241s | 278s | 273s | **yes — the straggler** |
| `test-shard (1)` | 158s | 157s | 127s | 156s | no |
| `test-shard (2)` | 85s | 92s | 92s | 87s | no |
| `test-shard (3)` | 96s | 98s | 102s | 99s | no |
| `test` (aggregator) | 65s | 94s | 109s | 108s | **yes — `needs: test-shard`** |
| `smoke` | 130s | 134s | 134s | 127s | **no — concurrent, finishes ~2.5 min early** |

Required-check wall clock ≈ slowest shard (~4.6 min) + aggregator (~1.6 min) ≈ **6.2 min**, entirely
inside the `test` chain (`we:.github/workflows/ci.yml:65` shards, `:141` aggregator, `:215` smoke).

### This refutes the obvious fix

The intuitive split — "keep the fast unit tests per-PR, move the slow browser suites to a batch run" —
buys **≈ 0 wall-clock**. `smoke` is the only browser suite still running (`visual` is `if: false` pending
#2232, `we:.github/workflows/ci.yml:372`; `test-selection-measure` is opt-in, `:298`), it costs 2.2 min,
and it finishes ~2.5 min *before* the `test` chain does. Moving it off per-PR saves a runner, not a minute.

The real per-PR cost is two things, neither of which is a browser suite:

1. **Shard imbalance.** Shard 4 runs 3.2× shard 2 (276s vs 85s). Even balancing alone would cut the
   critical path by roughly 2 min. This is a `vitest --shard` distribution problem, not a check-placement
   one, and it belongs to the test-selection work already shadow-running at `:298`.
2. **The serial aggregator.** `coverage:merge --threshold=80` (`:196`) and `check:standards` (`:200`) run
   *after* every shard finishes, adding ~1.6 min. Both are whole-repo checks — the coverage threshold is
   computed over the merged tree and `check:standards` is a cross-file repo-health gate — so they are
   arguably better evaluated on a combined batch than on one lane in isolation. Measured locally in the
   primary checkout: `check:standards` = 52s over 3301 backlog items, 0 errors.

## Measured — how big is a drain batch?

Merge commits on `origin/main` over 10 days, clustered into passes with a 10-minute idle gap:

```
passes: 124   median: 2   p75: 4   p90: 6   max: 49
distribution: {1-2: 80, 3-5: 27, 6-10: 11, 11-20: 5, 21+: 1}
```

N is small in the overwhelming common case (65% of passes land ≤2 PRs) with a thin long tail. This is the
number that decides the attribution strategy, and it argues strongly against bisection machinery.

## Prior art — how this is solved elsewhere

- **Bors-NG** — batches PRs, tests the batch, and on failure bisects (split, re-test each half, recurse)
  until the culprit is isolated. The original open-source formulation of "test the combination, not the
  parts".
- **GitHub merge queue** — builds *merge groups* (speculative combinations of the queued PRs), runs checks
  against each group, and on failure ejects the offending PR and re-forms the group from the survivors.
  Supports parallel speculative groups and a configurable maximum group size. **Ruled OFF for this repo by
  #2138 Fork 5** — it is branch-level and per-repo, so it reorders the cross-repo `impl-first/WE-last`
  couples the drain sequences. That ruling constrains, but does not forbid, an in-house batch gate: any
  batching here must stay per-repo and leave couple ordering to the drain.
- **Zuul (OpenStack)** — dependent change pipelines with *speculative execution*: PR1, PR1+PR2, PR1+PR2+PR3
  are tested concurrently on the optimistic assumption that everything ahead passes. A failure at PR2
  leaves PR1's result valid, ejects PR2, and re-queues PR3 on the new head. Full per-PR attribution *and*
  batching — paid for with N concurrent pipelines.
- **Google (TAP)** — presubmit runs only the dependency-affected target subset; the full suite runs
  continuously post-submit over batched changes, with an automated culprit finder bisecting a broken batch
  back to one CL.
- **Meta** — predictive (ML-ranked) test selection at presubmit, continuous post-land runs, automated
  bisection and auto-revert of identified culprits.

The common thread: **nobody accepts losing per-change attribution.** They differ only in what they spend
to recover it — extra runs (bisect), extra concurrency (speculate), or extra infrastructure (selection +
culprit-finding). At median N=2 / p90 N=6, the cheapest recovery here is the naive one: re-run each lane.

## The decisive constraint — this turf is already ruled and deferred

A skeptic pass on the first draft of `#xbi8dmf` found the governing statute the draft never cited:
[`#event-driven-land-is-wake-only`](../docs/agent/platform-decisions.md) (ratified 2026-07-27, #2692).
Verified against the anchor text:

- **Clause 3** defers *"the full event-driven MERGE-QUEUE build … speculative merge-commit …, per-step
  CAS/idempotent transaction-tail guards, **and the batching rider**"* behind a **measured
  `land-serialization` saturation trigger** — #2680's metric, *k > 1 ready PRs queued behind the sole
  writer, sustained over the window*. The ruled defaults are **pre-attached**, explicitly so that "no
  re-litigation is needed when it does" fire.
- **Clause 4** requires the un-gate to **surface and route** through the #2704 criticality
  decision-routing, possibly to operator confirm. It *"does not autonomously execute the build."*
- The tripwire that measures the trigger, **#2740, is `status: open`** — never built. So no measured trip
  has occurred.

A batch gate is therefore **not an open design question here.** It is a deferred build with its defaults
already ruled, waiting on a metric nobody has implemented yet. The honest next question is not *"which
batching design"* but *"is the deferral's trigger met, and what is owed to measure it."*

Separately, [`#gate-on-merged-tree-lane-fast-fail`](../docs/agent/platform-decisions.md) already ratifies
the *principle* — the binding gate runs once on the **merged** tree, citing the Not-Rocket-Science Rule and
Bors by name — so the batch-verification idea is settled doctrine, not a proposal.

## What survives as new

The measurements. Nothing in the cited rulings contains per-job CI timings, the observation that `smoke` is
off the critical path, the shard-imbalance figure, or the batch-size distribution. Those stand on their own,
and one of them supports work that is **not** deferred by anything: the `we:.github/workflows/ci.yml`
job-graph fix (de-serialize `check:standards`, rebalance the shards), which is repo-private CI shape and
explicitly outside the drain contract per
[`#repo-drain-check-contract`](../docs/agent/platform-decisions.md) — the drain consumes only the check
*name* `test` (`we:scripts/merge-ai-prs.mjs:2476`; `smoke` appears zero times in the drain).
