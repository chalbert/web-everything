---
bornAs: x9krtkb
kind: story
size: 3
status: resolved
scope: ["we:scripts/review-set-label.mjs", "we:scripts/lib/review-label-provider.mjs", "we:scripts/lib/review-escalation.mjs", "we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# Drain restamp loses human review:human clearance across a rebase, and stamps the pre-rebase head

restampAcceptance (we:scripts/merge-ai-prs.mjs ~728) re-stamps an acceptance after a drain-authored content-preserving rebase by shelling we:scripts/review-set-label.mjs --to=restamp. Two bugs, live on PR #2572: (1) the restamp path never reads PR comments (PR_STATE_FIELDS in we:scripts/lib/review-label-provider.mjs omits 'comments'), so it cannot see a prior --to=clear-human's cleared-human marker or call we:scripts/lib/review-escalation.mjs's parseLatestHumanClearedSha — the restamp comment carries reviewed-sha/reviewed-diff/reviewed-contribution but never cleared-human, so the next drain pass's anti-test-gaming gate (we:scripts/merge-ai-prs.mjs ~4105, shouldReparkForTestTampering) sees no human coverage and re-parks review:human, undoing every human clearance on the next rebase. (2) restampAcceptance already computes the authoritative new head (r.newCommit) but never passes it through; we:scripts/review-set-label.mjs re-reads headRefOid via a fresh gh pr view, which can race GitHub's propagation of the just-pushed commit and stamp the PRE-rebase head. Fix: restamp reads comments and, when the latest accept-shaped comment was a clear-human AND acceptanceCoversHead's existing diff/contribution-equivalence check proves the content unchanged, carries cleared-human forward bound to the new head (naming the original clearance) — a restamp of a plain agent accept stays plain. restampAcceptance passes --new-head=<sha> explicitly and the restamp path stamps that value instead of a freshly re-fetched headRefOid.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
