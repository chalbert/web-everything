---
kind: task
status: open
dateOpened: "2026-08-05"
tags: [drain, ci, gate, testing]
scope:
  - we:scripts/__tests__/merge-ai-prs.test.mjs
---

# Prove the rollup invariant exhaustively: an unfinished required-check entry always reads not-green, in every order and stamp combination

The latest-run rule is pinned by a handful of hand-picked fixtures; the property it must hold — an in-flight
entry is never green — should be proven over every permutation, not sampled.

## Why it is owed

Two successive cuts of `latestRequiredCheck` (`we:scripts/merge-ai-prs.mjs#latestRequiredCheck`) failed the SAME
invariant in different ways, and each time a new hand-written fixture was added afterwards to pin that one case:

- the timestamp-ranking cut compared one run's `completedAt` against another's `startedAt`, so a run that ENDED
  late outranked the newer run that had only STARTED;
- the same cut ranked a stamp-less entry as globally OLDEST, so an in-flight run could never suppress a stale
  SUCCESS;
- and it needed a special case for the `0001-01-01T00:00:00Z` sentinel GitHub reports for an unfinished run.

Every one of those is the same statement: **a rollup containing an unfinished required-check entry must read
not-green.** Sampled fixtures keep missing it because the failures live in the *combinations* — order × stamp
presence × sentinel — not in any single shape.

## Build

A table-driven test in `we:scripts/__tests__/merge-ai-prs.test.mjs` that generates, rather than lists, the cases:

- Build the cross product of: the two array orders (unfinished entry first / last); the stamp variants on each
  entry (a real ISO stamp, the `0001-01-01T00:00:00Z` sentinel, an empty string, an absent field, an
  unparseable string); and both `__typename` tiers (`CheckRun` and untagged).
- Assert for every generated rollup: `isRequiredCheckGreen` is `false` whenever ANY entry is unfinished and it
  is the newest by creation order, and `isRequiredCheckFailed` is `false` for the same shapes (in-flight is
  neither green nor red).
- Keep it as one `it` with an in-test loop that names the failing combination in the assertion message — an
  exhaustive matrix should not become several hundred test entries in the reporter.

Keep the existing narrative fixtures (the PR #1042 / #1046 shapes) — they document *why*; this proves *always*.

## Acceptance

- The matrix is generated in-test, so adding a stamp variant is a one-line change and every order is covered by
  construction.
- Re-introducing either the `completedAt`-vs-`startedAt` comparison or the stamp-less-ranks-oldest rule makes it
  fail, and the failure message identifies which combination broke.
- The merge-ai-prs test file is green on the current tree.
