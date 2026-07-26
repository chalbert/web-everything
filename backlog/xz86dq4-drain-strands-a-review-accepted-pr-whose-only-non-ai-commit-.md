---
kind: story
size: 3
status: active
dateOpened: "2026-07-26"
dateStarted: "2026-07-26"
tags: []
---

# Drain strands a review-accepted PR whose only non-AI commit is the drain's own rebase — never certified into the queue

A human-accepted, green, mergeable parked PR can become permanently invisible to the drain queue. Observed on web-everything#745: after `/review` cleared it to `review:accepted` it carried NO `ready-to-merge` label and no drain pass ever adds one, so it never lands.

## Root cause (traced)

Two independent producer-certification signals gate the drain (`we:scripts/merge-ai-prs.mjs`): the `ready-to-merge` label OR `isAiGeneratedPr` (every substantive commit carries the `Co-Authored-By: Claude` trailer). #745 has NEITHER at the point it matters:

1. It was parked for review while CI was still `checking` (blast-radius + `review:human`), so the CI-lifecycle transition `checking → ready-to-merge` never fired — it jumped onto the review track before earning the label. Clearing to `review:accepted` swaps the review label but does NOT mint `ready-to-merge`.
2. The drain's OWN rebase commit — `drain: rebase lane/… onto origin/main, drop …` — carries no `Co-Authored-By: Claude` trailer, and `isMechanicalMergeCommit` (in `we:scripts/merge-ai-prs.mjs`) only recognizes empty-body `Merge branch …` commits, NOT the drain's `drain:`-prefixed integration commits. So `isAiGeneratedPr` counts the drain's own commit as substantive human work and returns false.

Net: the post-CI reconcile (`shouldLabelOnGreen`, guards on `isAiGeneratedPr`) will never mint `ready-to-merge`, and `classifyPr` skips it absent the label ('a commit lacks the Co-Authored-By trailer'). `decideReviewGate` already says merge on `review:accepted` — but the PR never enters the candidate set nor gets certified, so that gate is never consulted. A human acceptance — the STRONGEST certification — is not treated as a certification signal at all.

## Fix (design)

Primary — treat `review:accepted` as a first-class producer-certification signal (a human clearing a parked PR IS 'this may merge'):
- `shouldLabelOnGreen`: mint `ready-to-merge` for a green PR carrying `review:accepted`, independent of `isAiGeneratedPr`.
- `classifyPr`: accept `review:accepted` as certification alongside the label / AI-trailer.

Defense-in-depth — stop the drain's own mechanical commits from reading as human:
- The drain should trailer its rebase / JIT-number integration commits with `Co-Authored-By: Claude` (they ARE AI-authored), and/or broaden `isMechanicalMergeCommit` to recognize the drain's `drain:`-prefixed no-product-content integration commits so historical untrailered ones don't disqualify.

Tests: a parked→`review:accepted`→green PR with a non-AI `drain:` rebase commit is certified + labelled `ready-to-merge` by a drain pass; an ordinary un-accepted non-AI PR still skips.

## Immediate unblock (already-stranded #745)

Manually add `ready-to-merge` to #745 — `classifyPr`'s `certifyLabel` path collects it regardless of `isAiGeneratedPr`, so the next drain lands it. (Done at filing time.) This item is the durable fix so it can't recur.

Trust-chain (gate-self) edit — `we:scripts/merge-ai-prs.mjs` — so the delivering PR parks `review:human` by design. Refs #2196 (producer certification), #2281 (ci-lifecycle labels), #2183 (ready-to-merge transport), #2285/#2326 (review-clear).

## Progress

- **Fix DELIVERED in this PR (the primary fix).** `review:accepted` is now a first-class producer-certification signal in `we:scripts/merge-ai-prs.mjs`: `classifyPr` certifies a human-cleared PR (new `humanCleared` field) and `shouldLabelOnGreen` mints `ready-to-merge` for a green `review:accepted` PR — both independent of the AI-trailer heuristic. +5 tests (210 pass). Parks `review:human` (gate-self); resolve this item after land.
- **Deferred (defense-in-depth, not in this PR).** Trailering the drain's own `drain:` integration commits with `Co-Authored-By: Claude`, and/or broadening `isMechanicalMergeCommit` to forgive them — a follow-up so the AI-authorship heuristic itself stops mis-reading drain commits as human.
