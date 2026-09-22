---
bornAs: xm5rdrn
kind: story
size: 5
parent: "3383"
status: resolved
scope: ["we:scripts/operations/review-dispatch.mjs", "we:scripts/lib/main-staleness.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
tags: []
---

# Extract assertMainNotStale into a shared main-freshness helper

**Corrected on pickup:** the card as filed said we:scripts/operations/review-dispatch.mjs was "the ONLY conveyor script that self-checks main freshness" and proposed a brand-new we:scripts/lib/main-freshness.mjs. Both were wrong on re-read: `assertMainNotStale` was already SHARED by two callers (we:scripts/operations/review-dispatch.mjs's own `dispatchReview`, and we:scripts/conveyor/reconcile-fix-dispatch.mjs, which already imports it from there), and the real underlying git-comparison logic it wraps (`checkMainStaleness`/`classifyStaleness`) already lives in a pure lib, we:scripts/lib/main-staleness.mjs — the exact kind of shared home the card wanted to invent. The actual gap: `assertMainNotStale` itself (the throwing wrapper) still lived inside we:scripts/operations/review-dispatch.mjs, so a future daemon (a watcher, or the Verify/Supervisor daemons #3860's siblings add) would have had to import the whole review-dispatch module just for this one guard.

## Progress

Moved `assertMainNotStale` and its `staleRemedy` tail from we:scripts/operations/review-dispatch.mjs into we:scripts/lib/main-staleness.mjs (a pure lib with no review-specific dependencies). Added a `label` parameter (default `'review-dispatch'`, preserving byte-identical default behavior for both existing callers) so a future caller's thrown/logged message reads as itself instead of always saying "review-dispatch". we:scripts/operations/review-dispatch.mjs now re-exports `assertMainNotStale` from the new home, so neither existing importer (its own `dispatchReview`, and we:scripts/conveyor/reconcile-fix-dispatch.mjs) needed an import change.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/main-staleness.test.mjs -t "a caller-supplied label replaces the prefix"` passes (the new, genuinely-shared surface); `npx vitest run we:scripts/operations/__tests__/review-dispatch.test.mjs -t assertMainNotStale` and `npx vitest run we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs` still pass with zero import changes in either file (126/126 across the 3 suites, verified).
