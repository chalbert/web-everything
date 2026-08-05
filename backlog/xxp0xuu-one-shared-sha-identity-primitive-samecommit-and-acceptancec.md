---
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# One shared SHA-identity primitive — sameCommit and acceptanceCoversHead decide the same question twice

PR #1039 review finding 12. we:scripts/fetch-parked.mjs's sameCommit and we:scripts/lib/review-escalation.mjs's acceptanceCoversHead both answer 'is the tree I judged the tree that lands', both by prefix identity, with DIVERGENT validation — different hex bounds, different tolerance for whitespace and case, different fail-closed behaviour on a malformed input. Two gates deciding one question is the hand-copied-twin shape that went stale once already in this repo (#2823's VERDICT_STRICTNESS). Extract one primitive and have both call it, with the strictest of the two validations. Small, but it is a correctness seam: the two can disagree about whether an acceptance still covers the head.
