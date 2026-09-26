---
bornAs: xkw1yqc
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/lib/review-escalation.mjs", "we:scripts/lib/marker-authorship.mjs", "we:scripts/review-set-label.mjs", "we:scripts/lib/__tests__/review-escalation.test.mjs"]
relatedTo: ["4092"]
dateOpened: "2026-09-25"
dateResolved: "2026-09-26"
tags: []
---

# reviewed-sha / reviewed-diff markers accept ANY commenter, not just a trusted author

we:scripts/lib/review-escalation.mjs's parseReviewedSha/parseReviewedDiff read the LATEST reviewed-sha/reviewed-diff marker from ANY PR comment author (the file's own docblock names this a conscious residual: 'be honest — this is a trust signal ... Not defended here'). we:scripts/lib/marker-authorship.mjs (built by #4092/4092 to close the identical hole for stand-down/rearm/ci-heal/advisory/conflict-fix markers) explicitly lists this pair as NOT IN SCOPE / a flagged follow-up in its own header, on the grounds that narrowing it touches we:scripts/review-set-label.mjs's accept/re-stamp contract. WE's PRs are public, so any GitHub login can post a fake reviewed-sha/reviewed-diff comment matching the current head and forge review coverage for #2409's staleness gate. Fix: filter comments through we:scripts/lib/marker-authorship.mjs's isTrustedMarkerAuthor before matching REVIEWED_SHA_MARKER/REVIEWED_DIFF_MARKER in parseReviewedSha/parseReviewedDiff, mirroring the #4092 pattern; audit we:scripts/review-set-label.mjs's stamp/re-stamp path for the same gap.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
