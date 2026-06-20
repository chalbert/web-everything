---
kind: story
size: 2
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: scripts/check-standards-rules.mjs
tags: []
---

# Loud-fail when the backlog classification axis is unpopulated (don't render all-zero readiness silently)

Make the loader/validator ERROR when an open item's classification axis can't be resolved — rather than silently rendering an empty board. Caught live during #487's type+workItem→kind cutover: consumers (we:src/_data/backlog.js, we:scripts/readiness/engine.mjs) were switched to `item.kind` ahead of the data, so `kind` was undefined for every item and the `/backlog/` Prioritisation tab showed 0 batchable / 0 decision / 0 program — a silent collapse, not a loud break.

## The gate

- Assert every open item resolves to a valid `kind` (else error), not `undefined`.
- Add a counts-invariant: open>0 but `{batchable, tierB, sliceable}` all 0 is a hard error, not a quiet zero.

Mirrors the #466 Fork-2 "loud break" but for the *during*-migration window (consumers ahead of producers) — which #487's after-cutover leftover-field backstop does not cover. Lands in the post-#487 validator.

## Progress

Resolved 2026-06-20. Cleared the stale `blockedBy: [487]` (the cutover landed — items now carry `kind:`).

- **Bullet 1 (valid kind):** already covered by the existing per-item gate — `kind` is a required field
  (we:scripts/check-standards-rules.mjs `validateBacklogItem`, missing-field error) and is enum-checked
  against `BACKLOG_KINDS`. An open item with `kind: undefined` already red-gates. Not duplicated.
- **Bullet 2 (counts-invariant), NEW:** added a pure `detectClassificationCollapse(items)` helper to
  we:scripts/check-standards-rules.mjs and wired it into we:scripts/check-standards.mjs (after the
  per-item loop). It hard-errors when open>0 but `{batchable, tierB, sliceable}` are ALL zero — the exact
  observable signature of the #487 near-miss, where `kind` undefined zeroes all three kind-keyed pools at
  once even though `deriveTier` still hands the item Tier A (so a tier check alone misses it). The error
  reports the open count, the three zeroed pools, and the count of kind-less open items for diagnosis, and
  points at the producer (we:src/_data/backlog.js). Guarded to return null on an all-resolved backlog.
- Unit tests: 5 cases in we:scripts/__tests__/check-standards-rules.test.mjs (healthy board, all-resolved,
  kind-undefined collapse, bucketing-logic break with valid kinds, resolved-not-counted). Gate green.
