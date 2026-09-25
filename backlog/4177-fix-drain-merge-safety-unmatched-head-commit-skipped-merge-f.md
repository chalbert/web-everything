---
bornAs: xvzc4v4
kind: story
size: 5
parent: "4075"
status: resolved
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/lib/pr-merge-gate.mjs", "we:scripts/lib/review-escalation.mjs", "we:scripts/lane-drain.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# fix drain merge-safety: unmatched head commit, skipped merge follow-up, review-hold covers unknown head

Three merge-safety bugs found by an adversarial read-only review of the drain (epic #4075/#3383). (1) we:scripts/lib/pr-merge-gate.mjs's gh pr merge carries no --match-head-commit, so a push or a review:changes added mid-pass after the pass-start label/CI listing isn't seen before the merge. (2) we:scripts/merge-ai-prs.mjs's isPrAlreadyMerged recovery path treats a merge our own gh call failed to confirm (local branch-delete failure, network drop after a real GitHub-side merge) or a GitHub-UI merge as 'merged by a concurrent lander' and skips it from the merged[] bucket, so JIT numbering/resolve-on-land/derived-regen never run for it -- and since the PR drops off the NEXT pass's open-PR listing once merged, this is a permanent skip, not a deferral. (3) we:scripts/lib/review-escalation.mjs's acceptanceCoversHead returns covers:true (fail OPEN) when either the accepted or head SHA is unknown or unreadable, so a broken read silently waves an unverified head through instead of parking it. Fix: pass --match-head-commit and re-classify against a fresh gh pr view right before merging; route every detected-merged PR (however discovered) through the same idempotent numbering/resolve-on-land/regen follow-up so it runs exactly once; flip the unknown-SHA branch of acceptanceCoversHead to fail CLOSED (covers:false, park). Proof: vitest red-to-green per bug (a fixture for each) plus a live read-only 'node we:scripts/merge-ai-prs.mjs --dry-run' before/after against the real open PRs showing unchanged decisions for healthy PRs.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
