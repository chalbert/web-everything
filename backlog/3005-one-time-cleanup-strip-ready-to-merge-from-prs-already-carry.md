---
bornAs: xtw8e93
kind: story
size: 2
status: open
dateOpened: "2026-08-02"
relatedTo: ["2832"]
tags: [conveyor, drain, review, ci-lifecycle]
---

# One-time cleanup: strip ready-to-merge from PRs already carrying both it and a review hold

Split out of **#2832** (PR **#984**). #2832's write-time invariant guarantees the contradictory
"held AND `ready-to-merge`" state can no longer be *created* — every write site that stamps the go-ahead
now refuses under a hold, and the escalation park strips the go-ahead atomically when it applies the hold.
But that is forward-looking only: it does nothing for PRs that **already** carry both labels right now, from
before the invariant landed.

## The gap

Any open PR that today holds both `ready-to-merge` and one of `review:human` / `review:pending` /
`review:changes` stays in that inconsistent state until *something* touches it. With the per-pass
drain-reconcile strip deliberately dropped from #984 (it was the source of every ordering regression, so it
was removed — see the PR's shrink), nothing sweeps these stragglers automatically anymore.

Merge safety is not at risk — the drain's merge gate independently re-checks the hold and parks a held PR
regardless of `ready-to-merge` (the label is a collection filter, never the land gate). This is a
**hygiene / legibility** cleanup, not a safety fix.

## What to do

A **one-shot** correction, not a standing per-pass reconcile:

- Enumerate open PRs across the constellation (WE + frontierui + plateau-app) that carry both
  `ready-to-merge` and an uncleared review hold.
- Strip `ready-to-merge` from each (the hold wins — held PRs may not carry the go-ahead).
- Either a small documented hand-strip, or a narrow one-shot script run once and then removed. Explicitly
  **NOT** a per-pass `reconcileCiLifecycleLabels` strip — that coupling of the go-ahead to the drain's scope
  filter is exactly what #984 reverted.

## Acceptance

- Every currently-open PR carrying both `ready-to-merge` and a review hold has had `ready-to-merge` stripped.
- No per-pass reconcile strip is introduced (the correction is one-shot).
- The remaining ongoing invariant is #2832's write-time guard alone.
