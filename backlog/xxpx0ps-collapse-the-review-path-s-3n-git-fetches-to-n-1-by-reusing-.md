---
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# Collapse the review path's 3N git fetches to N+1 by reusing one resolved basis

PR #1031 review r3, non-blocking. we:scripts/fetch-parked.mjs's resolveNetDiff fetches the head ref, then computeNetDiffText and computeNetDiffPaths each call resolveNetDiffBasis, which fetches again — three network round trips per PR where one would do. fetch-parked maps over N PRs, so the review path pays 3N. Deliberately NOT bundled into PR #1031: that PR is engine-tier, has bounced three review rounds, and each added surface produced a new defect, so a non-blocking perf refactor did not belong in it. The fix is contained — thread an optional pre-resolved basis into computeNetDiffText/computeNetDiffPaths (both already take the same opts shape and both go through resolveNetDiffBasis), or export the basis resolver and have resolveNetDiff drive the two diff commands directly off one resolution.
