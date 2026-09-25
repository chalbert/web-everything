---
bornAs: x3zr5tu
kind: story
size: 2
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/parked-pr-conflict-watch.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Parked-PR conflict watch: make the conflict label and its one-time comment crash-safe

Audit: we:reports/2026-09-24-daemon-blocking-antipatterns.md. Finding P4 (becomes an idempotent effect). we:scripts/conveyor/parked-pr-conflict-watch.mjs writes the merge-status:conflicting label before posting the alert comment. A crash between them lost the comment for good, because the label then marked the PR as already handled. Fixed the ordering: the alert comment (marker-deduped by its own fixed header, recency-scoped via `CONFLICT_RETRY_WINDOW_MS`) and the fix/stand-down dispatch (marker-deduped the same way, or via the existing stand-down comment count) both go out — or are confirmed already-posted — BEFORE the `merge-status:conflicting` label is applied, which now happens LAST.

Folded in three adversarial-review findings against the same file, verified against the live code before fixing:
- (a) confirmed — a crash between the label and the dispatch left `plan.add` reading null on the next sweep (already labelled → skipped), losing the routing decision forever. Fixed by the same reordering: the label no longer applies until the dispatch/stand-down has succeeded or is already on the thread.
- (b) partially confirmed — the "unreadable events API waits forever" half is real: `defaultConflictLabelAgeMs` returning `null` on every sweep (a persistent `gh` failure, not a blip) left the queued-grace check waiting past grace forever with no fallback. Fixed with a fallback to this watch's own durable alert-comment timestamp. The "uses the latest labeled event even from an earlier episode" half was investigated and could NOT be reproduced: the existing per-page-`last`-then-`Math.max` design already recovers the true global-latest labeling event across GitHub's own paginated jq behavior, regardless of how many past episodes a PR has been through — left unchanged (see the code comment at that function's own call site for the reasoning).
- (c) confirmed — `postRearm` fired purely off `mergeable: MERGEABLE`, with no check for a fix-agent session still live on the same PR (mid-push, or resolving something else on the same lane). Fixed with a name-based liveness check (we:scripts/conveyor/review-status-tag.mjs's `deriveReviewStatus`, the same primitive that file already uses to stay independent of we:scripts/conveyor/reconcile-core.mjs's heavier `assessLiveness` import graph); while live, the rearm AND the `merge-status:conflicting` label removal are both deferred together (removing the label alone would strand the rearm the same way (a) strands a fresh dispatch).

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/parked-pr-conflict-watch.test.mjs` passes,
   including the new `#4118` crash-safety (comment/dispatch survive a crash before the label lands, and are
   never duplicated on retry), grace-path fallback-age, and live-fixer rearm-deferral cases that did not exist
   (and would fail, confirmed by stashing just the source fix back to its pre-#4118 shape) before this item
   landed. A real `node we:scripts/conveyor/parked-pr-conflict-watch.mjs sweep --dry-run
   --repo=chalbert/web-everything` was also run before and after the fix — read-only, no PRs currently
   conflicting on that repo, so both report `{"changed":0}` with no crash either way.
