---
bornAs: xhw9h59
kind: story
size: 3
parent: "2405"
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/check-standards.test.mjs
status: open
dateOpened: "2026-07-28"
tags: [review-gate, drain, conveyor]
scopeRationale: The veto-guard's exact fix site is investigation-dependent (the land-gate path landing labelled PRs); we:scripts/merge-ai-prs.mjs is the best first guess. we:scripts/__tests__/check-standards.test.mjs is the fold-in test-cleanup site. Deliberately excludes we:scripts/lib/review-core.mjs (trust-chain / gate-self).
---

# A `review:changes` (or any unresolved `review:*`) label must veto the land — independent of `ready-to-merge`

On 2026-07-28, PR #870 (WE #2739) received an independent `review:changes` verdict via /review, yet MERGED while still labeled `review:changes` (the label was never flipped to `review:accepted`), because it carried `ready-to-merge` and the drain/land path landed it anyway. Separately, during the review a background drain/conveyor process stamped `review:accepted` onto that `review:changes` PR (removed by hand; it merged regardless). The land gate must treat an unresolved `review:*` label (`review:changes`, `review:pending`, `review:human`) as a HARD merge blocker that vetoes the land no matter what `ready-to-merge` says.

## Detail

- Investigate two things: (a) the land path (`we:scripts/merge-ai-prs.mjs` / the drain land gate) that landed #870 despite `review:changes`; (b) what wrote `review:accepted` onto a `review:changes` PR mid-review.
- Proposed guard: any unresolved `review:*` label vetoes the land, independent of `ready-to-merge`.
- Note: #870's SUBSTANCE was fine — the doc fix (commit 96156d15) was in before it landed — so this is purely a process/gate defect, not a bad merge. Sibling to #2745 ("a formerly-review:human PR must survive its human gate").

## Fold-in cleanup (small)

- The #2739 lint's "false-positive corpus guard" test in `we:scripts/__tests__/check-standards.test.mjs` is hollow — its assertions just restate conditions `dirLevelScopeFinding` already guarantees by construction, so it can never go red (unlike the real `offenders.toEqual([])` oracle above it). Give it a real oracle or drop the "false-positive guard" framing.
