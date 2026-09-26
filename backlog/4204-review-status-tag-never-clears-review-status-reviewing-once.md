---
bornAs: x8who76
kind: story
size: 2
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/review-status-tag.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:skills-src/conveyor/review-daemon.mjs"]
dateOpened: "2026-09-26"
dateResolved: "2026-09-26"
tags: []
---

# review-status-tag never clears review-status:reviewing once a PR's review is accepted

A PR that reaches phase 'queued' (review:accepted or ready-to-merge, we:scripts/progress-board.mjs#classifyPr) is neither OWED nor OWED_ELSEWHERE, so we:scripts/conveyor/reconcile-core.mjs#selectStatusCandidates refuses it as nothing-owed and — by explicit design — excludes every nothing-owed refusal from the status-refresh sweep. we:scripts/conveyor/review-status-tag.mjs is therefore never re-invoked for that PR again, so a stale review-status:reviewing (or fixing/stalled) label added while the review was still live is never cleared once it accepts. Confirmed live on chalbert/web-everything#2711: review:accepted at 13:07Z, ready-to-merge at 13:08Z, review-status:reviewing (added 12:59Z) never unlabeled. Same bug CLASS as the #1920 owed-elsewhere miss and the #2472 fix-owed miss selectStatusCandidates already fixed twice — this is the third exclusion (nothing-owed) proving wrong the same way. Fix: stop excluding nothing-owed from we:scripts/conveyor/reconcile-core.mjs#selectStatusCandidates (tagReviewStatus is idempotent/name-keyed and cheap when reads are shared, #4133 — a no-op write for any PR with nothing stale).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
