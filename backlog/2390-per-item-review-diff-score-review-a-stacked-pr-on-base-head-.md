---
kind: story
size: 3
parent: "2387"
status: active
blockedBy: ["2389"]
dateOpened: "2026-07-10"
dateStarted: "2026-07-10"
tags: []
---

# Per-item review diff: score/review a stacked PR on base...head, not vs main

Compute the escalation score + reviewer-subagent input in we:scripts/merge-ai-prs.mjs as base...head (from the manifest base) instead of vs main, so a stacked PR is reviewed on its OWN delta — killing cumulative-diff blast-radius inflation and spurious review:human inheritance from ancestors. Tests: a deep stacked PR scores on its own change, not the cumulative stack; no spurious review:human inherited from an ancestor.

## Progress

- **Status:** done — tests + `check:standards` green
- **Branch:** lane-5 (`lane/2390-per-item-review-diff-score`)
- **Done:**
  - we:scripts/readiness/lane-manifest.mjs — added two pure helpers: `repoKeyFromSlug` (git slug/short name → manifest repo key, `web-everything`→`we`) and `manifestBaseForRepo` (the per-repo stacked `base` SHA a scorer diffs from, or `null`).
  - we:scripts/merge-ai-prs.mjs — `computeNetDiffChangedFiles` gained an optional `baseRev`: when a git-hash-shaped manifest base is passed it diffs `base…head` (own delta) and drops the `+main:` tracking-ref fetch; a malformed value is ignored (falls back to `origin/main`). The drain sets `v.base` from the couple manifest for the PR's repo and passes it into the scorer.
  - we:scripts/pr-land.mjs — the producer (the SHARED #2373 basis) passes the same manifest base, so producer + drain never drift and no spurious `review:human` is applied at PR-open (which the drain's sticky-label logic would otherwise keep).
- **Notes:** any failure to resolve a base → `null` → the exact prior `origin/main` behavior, so siblings are untouched and the change is strictly safe. Tests added in we:scripts/__tests__/merge-ai-prs.test.mjs (baseRev own-delta, dropped `+main` fetch, injection guard, no-spurious-review:human via `scoreEscalation`) and we:scripts/__tests__/lane-manifest-write.test.mjs (both helpers).
