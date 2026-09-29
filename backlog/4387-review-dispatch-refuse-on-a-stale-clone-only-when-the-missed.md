---
bornAs: x3ei6wr
kind: story
size: 3
tier: pinned
status: active
scope: ["we:scripts/lib/main-staleness.mjs", "we:scripts/operations/review-dispatch.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-29"
tags: []
---

# Review dispatch: refuse on a stale clone only when the missed commits touch the review code path

we:scripts/lib/main-staleness.mjs's guard, called from we:scripts/operations/review-dispatch.mjs (#3439), refuses a review dispatch when the dispatching clone is even 1 commit behind origin/main. The drain lands about one PR a minute and a daemon rebuild takes minutes (longer when its smoke check hits the GitHub rate limit), so the review daemon spends long stretches refusing: live 2026-09-28 the review-daemon log recorded 970 stale refusals before the 9:32 PM ET restart, and the clone sat 4-18 commits behind. MVP: compute the files changed in HEAD..origin/main and refuse only when one is on the review code path (the review operation and its imports: we:scripts/operations/review-pr.mjs, we:scripts/operations/review-dispatch.mjs, we:scripts/operations/cli-adapter.mjs, we:scripts/lib/ judge/jury/review modules — derive the set from the import graph or a declared list); otherwise dispatch and log the tolerated lag. Must: unit test for both branches; live proof: with the clone behind by commits that do not touch the review path, a review dispatches (before: refused). Follow-up: same rule for the fix and verify dispatchers.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-dispatch.test.mjs -t "#4387"`: a real
   managed clone behind origin/main in code OFF the review path dispatches (before: refused with the stale
   marker), and one behind in we:scripts/operations/review-pr.mjs still refuses.

## Progress

- `assertMainNotStale` (we:scripts/lib/main-staleness.mjs) takes an opt-in `dispatchPath` predicate: a MANAGED
  clone behind only in code files the predicate rejects dispatches and logs the tolerated lag
  (`behindOffDispatchPath`). Unknown/empty behind-file list still refuses (fail closed); unset keeps the #4044
  rule; unmanaged checkouts are unchanged (they auto-ff, or get the reason-specific refusal).
- we:scripts/operations/review-dispatch.mjs declares `isReviewCodePath` (review/judge/jury modules under
  `scripts/{operations,lib,conveyor}/`, we:scripts/operations/cli-adapter.mjs, and the guard itself) and passes
  it. A declared list, not the import closure: review-dispatch + review-pr + cli-adapter statically reach ~190
  files, so the closure would refuse on nearly every landed PR.
- Unit tests for both branches plus fail-closed cases (we:scripts/lib/__tests__/main-staleness.test.mjs);
  real-call-path tests through `dispatchReview` on a real temp git clone
  (we:scripts/operations/__tests__/review-dispatch.test.mjs).
- Follow-up (not in this item): the same rule for the fix (we:scripts/conveyor/reconcile-fix-dispatch.mjs) and
  verify dispatchers — pass their own `dispatchPath`.
