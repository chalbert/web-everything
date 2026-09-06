---
bornAs: xzdzg3j
kind: story
size: 2
status: open
scope: ["we:scripts/operations/run-record.mjs"]
dateOpened: "2026-09-06"
tags: [cost, observability, operations, prompt-caching]
relatedReport: reports/2026-09-06-token-optimisation-research.md
---

# Surface cache hit rate from the `usage` already in run records

Every agent invocation already stores its raw `usage` — including `cache_read_input_tokens` and
`cache_creation_input_tokens` — but **nothing computes a hit rate from it, and no item on the board mentions
one**. A hit rate of zero across repeated invocations is the single highest-value cost alert available here,
and today it would pass unnoticed.

## What already exists, so this stays small

The data is retained end-to-end: [`we:scripts/lib/judge-panel.mjs`](../scripts/lib/judge-panel.mjs) passes
`usage: r.usage` through, and [`we:scripts/operations/run-record.mjs`](../scripts/operations/run-record.mjs)
copies `usage` one level deep with its numeric entries into the row. `loadedContextTokens` in
[`we:scripts/lib/judge-spawn.mjs`](../scripts/lib/judge-spawn.mjs) sums the three counters, but that is a
derived helper — it destroys nothing, and the components survive.

So this is a **read-side** item: derive `cache_read / (cache_read + cache_creation + input)` per row, and
aggregate it per role across a run. Size 2 because the plumbing is done.

## Why it is worth having

The research grounding it ([token optimisation](/research/token-optimisation-research/)) reports production
deployments moving 7% → 74% hit rate from a single prompt-ordering fix, cutting inference cost 59%, and treats
**below 40% on a stable-prompt workload as a structural bug rather than a tuning opportunity**. Without the
derived figure there is no way to notice either state.

This repo already has one accidental data point: #3383's accrued `costTokens` line works out to roughly **162
reads per write**. That is aggregate interactive-session caching rather than a measured dispatch role, which is
exactly why a per-role figure is worth deriving rather than inferring.

## Done when

1. **Executable** — a command prints per-role cache hit rate and reads-per-write from stored run records, and a
   fixture with a known split asserts the arithmetic.
2. A zero hit rate across repeated same-role invocations is *surfaced*, not silently averaged away.
