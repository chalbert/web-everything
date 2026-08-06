---
kind: task
status: open
relatedTo: ["2895"]
dateOpened: "2026-08-06"
scope:
  - we:scripts/lib/verdict-totality.mjs
  - we:scripts/lib/__tests__/verdict-totality.test.mjs
tags: [gate, review, testing, prevention]
---

# Enum-totality over the review-label target set for anything that projects or renders per target

PR #1056's comment-size pre-flight hardcoded one target and under-counted another, which can leave a PR accepted with no reviewed-sha marker and the staleness gate silently disarmed.

Prevention (c) of three carved out of the round-1 review of **PR #1056** (#2895's implementation), from finding
**M2**. The instance is fixed in that PR (`projectVerdictCommentLength` is total over `REVIEW_LABEL_TARGETS`,
with a per-member test); the CLASS is not.

## The class

`we:scripts/lib/verdict-totality.mjs` already enforces enum-totality over the review **VERDICTS**. The same
discipline is owed to the review-label **TARGET** set — `accepted`, `changes`, `rearm`, `clear-human` — because
a per-target renderer or projection that silently covers only one member fails in the worst direction:

> the `GH_COMMENT_MAX` pre-flight projected `to: 'accepted'` while a `clear-human` comment renders a longer
> heading plus its attribution block. A body just under the cap passed the check, the label swap landed,
> `gh pr comment` then failed on GitHub's cap, and the PR was left **`review:accepted` with no `reviewed-sha`
> marker** — and `acceptanceCoversHead` **fails open** on a missing marker, so the staleness gate is disarmed
> without a sound.

The failure is not "a wrong number"; it is a partial swap that the module's own comment (PR #1005) says must
never happen.

## The guard

Extend the verdict-totality machinery to a second enum: any function that switches on, projects from, or renders
per review-label target must be provably total over
`we:scripts/review-set-label.mjs#REVIEW_LABEL_TARGETS`. Same shape as the existing `VERDICTS` gate — the marker
comment plus the structural check — so adding a fifth target reddens the gate instead of quietly under-covering.

## Done when

- The totality checker covers the review-label target set as well as `VERDICTS`.
- A fixture that adds a target without extending a per-target projection turns the gate red.
- `we:scripts/review-set-label.mjs`'s projection carries the marker rather than relying on its own hand-written
  per-member test loop.
