---
kind: story
size: 3
parent: "2387"
status: resolved
blockedBy: ["2389"]
dateOpened: "2026-07-10"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
graduatedTo: none
tags: []
---

# Per-item review diff: score/review a stacked PR on base...head, not vs main

Compute the escalation score + reviewer-subagent input in we:scripts/merge-ai-prs.mjs as base...head (from the manifest base) instead of vs main, so a stacked PR is scored on its OWN delta — killing cumulative-diff blast-radius SIZE inflation. Tests: a deep stacked PR scores its SIZE on its own change, not the cumulative stack.

**Security constraint (review-fix):** the `base` rides the EDITABLE PR body, so it must NEVER be able to narrow or suppress the gate-self / `review:human` trigger. The human-gate basis therefore stays the cumulative `origin/main…head` file set, and the base is trusted for the SIZE de-inflation only when it provably is a strict ancestor of head. An ancestor's OR the child's edit to the auto-review trust chain always forces `review:human` (over-escalation is the safe direction, #2285).

## Progress

- **Status:** done — tests + `check:standards` green
- **Branch:** lane-5 (`lane/2390-per-item-review-diff-score`)
- **Done:**
  - we:scripts/readiness/lane-manifest.mjs — added two pure helpers: `repoKeyFromSlug` (git slug/short name → manifest repo key, `web-everything`→`we`) and `manifestBaseForRepo` (the per-repo stacked `base` SHA a scorer diffs from, or `null`).
  - we:scripts/merge-ai-prs.mjs — `computeNetDiffChangedFiles` gained an optional `baseRev`. It returns `humanBasisFiles` = the cumulative `origin/main…head` file set (the gate-self / human-gate basis, which `baseRev` can never shrink), and de-inflates `changedFiles`/`diffLines` (SIZE) to `base…head` ONLY when `baseRev` is a strict ancestor of head (`isStrictAncestor`: rejects `base==head` and any non-ancestor/unrelated tree). A malformed value is ignored (falls back to `origin/main`); the `+main:` tracking-ref fetch is ALWAYS run. The drain sets `v.base` from the couple manifest and passes it into the scorer.
  - we:scripts/lib/review-escalation.mjs — `scoreEscalation` reads the gate-self / `humanRequired` signal from `humanBasisFiles` (falling back to `changedFiles` when absent), so a de-inflated own-delta can shrink SIZE but never the human gate.
  - we:scripts/pr-land.mjs — the producer passes the same manifest base and threads `humanBasisFiles` through `resolveProducerReviewLabel`, so producer + drain never drift.
  - we:scripts/readiness/lane-manifest.mjs — `manifestAuditLine` now records `base=<hash>|none` so the de-inflating basis is in the tamper-evident trail; two pure helpers `repoKeyFromSlug` + `manifestBaseForRepo`.
- **Notes:** any failure to resolve a base → `null` → the exact prior `origin/main` behavior, so siblings are untouched. Tests added in we:scripts/__tests__/merge-ai-prs.test.mjs (own-delta SIZE de-inflation + cumulative `humanBasisFiles`; ancestor gate-self edit still forces `humanRequired:true`; `base==head` and non-ancestor base rejected → cumulative fallback; injection guard), we:scripts/readiness/__tests__/lane-manifest.test.mjs (audit-line `base`), and we:scripts/__tests__/lane-manifest-write.test.mjs (both helpers).
