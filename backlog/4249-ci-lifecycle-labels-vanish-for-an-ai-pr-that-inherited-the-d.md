---
bornAs: xg790dh
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/lib/ai-pr-authorship.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/conveyor/review-status-tag.mjs", "we:scripts/__tests__/merge-ai-prs-ai-detection-and-drain-ordering.test.mjs", "we:scripts/__tests__/merge-ai-prs-ci-lifecycle-and-land-effects.test.mjs", "we:scripts/conveyor/__tests__/review-status-tag.test.mjs"]
dateOpened: "2026-09-26"
dateResolved: "2026-09-27"
tags: []
---

# ci-lifecycle labels vanish for an AI PR that inherited the drain's own bookkeeping commits

isAiGeneratedPr (we:scripts/lib/ai-pr-authorship.mjs) returns false for a PR whose inherited history (from merging/rebasing a newer main) carries the drain's own direct-to-main commits (drain: JIT-number ... at land (#2288), drain: resolve #NNN on land (#2748), drain: rebase ...) or a merge commit whose body is only git's auto-appended # Conflicts: footer -- neither shape is authored content, but neither was recognized as mechanical. Via we:scripts/merge-ai-prs.mjs's ciLifecycleCertified gate (and labelOnGreenVerdict's identical gate), this silently disqualifies an otherwise fully-AI PR from the #2281-ratified ci-lifecycle reconcile (checking/ci:failed/blocked/ready-to-merge) for as long as it has neither ready-to-merge nor review:accepted yet -- worse than the #3729/#2685 case the existing OR-based certification fallback covers, since that only helps a PR already at ready-to-merge/review:accepted; an early-negotiation PR has no escape hatch. Confirmed LIVE on chalbert/web-everything#2741: review:pending + review-round:1 only, no ci-lifecycle label, while test/daemon-soak were IN_PROGRESS. Fix: we:scripts/lib/ai-pr-authorship.mjs exports isDrainBookkeepingCommit (matches the shared drain: headline prefix) and strips git's own # Conflicts: footer before isMechanicalMergeCommit's empty-body check; both excluded from isAiGeneratedPr's substantive-commit filter. Also closes a smaller gap: we:scripts/conveyor/review-status-tag.mjs's deriveReviewStatus had no mapping for a live ci-heal-<pr> session (a CI-fixer on a red PR showed no review-status:* label at all) -- added healing-ci/ci-heal-stalled states, same PR_KINDS session-slug machinery. The conflict-bounce case originally reported (a live fix-<pr> session on a review:changes + merge-status:conflicting PR) already produces review-status:fixing correctly under current code (selectStatusCandidates already includes every refusal unconditionally, fixed today in #4204) -- pinned with a regression test using PR #2741's real fixture, no code defect found there.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
