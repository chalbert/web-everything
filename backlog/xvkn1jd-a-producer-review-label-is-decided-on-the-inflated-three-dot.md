---
kind: story
size: 2
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/pr-land.mjs
tags: []
---

# A producer review label is decided on the inflated three-dot basis

pr-land derives the review label from GitHub's three-dot file list, so a branch merely BEHIND main is labelled from other people's changes — and a false review:human is then clearable only by a human ceremony.

## Reproduced, not theorised

PR #1595 added **three backlog cards and nothing else**. It opened labelled `review:human`, with the reason
*"blast-radius (…platform-decisions…); statute (…platform-decisions…) — human review required"*.

The branch touches no statute file. It was **one commit behind `main`**, and
`we:docs/agent/platform-decisions.md` had changed on `main` in that commit. GitHub's three-dot diff attributes
such a file to the PR, so the statute-edit rule fired on somebody else's change.

After rebasing onto `main`, the PR's file list corrected itself to the three cards. **The label did not
re-evaluate.**

## Why the stickiness is the expensive half

A wrong `review:pending` costs a review round. A wrong `review:human` costs **a person**, and it is
deliberately one-way: `decideSetLabel` refuses `accepted` on a `review:human` PR (INVARIANT 2), and the only
thing that removes the label is the human ceremony — an operator instruction, quoted verbatim, on a named PR.

That fail-closed design is right for a real statute edit and exactly wrong for a basis error. The recovery used
on #1595 was to **close it and reopen from the same rebased commit**, which is cheap but leaves a closed PR in
the record and works only because the mistake was caught immediately.

## The fix is already half-built elsewhere

The review side has known since #2450/#2901 that the three-dot list is inflated, and `review-pr` computes its
diff on the **net basis vs current `main`** for exactly this reason — `we:skills-src/review/SKILL.md` says
*"`gh pr diff`'s inflated three-dot list never reaches it."* The producer-side label derivation in
`we:scripts/pr-land.mjs` did not get the same treatment.

[#3317](/backlog/3317/) reworks the escalation basis to a cumulative merge-base measurement and threads it
through `resolveProducerReviewLabel`. **Check whether that already closes this before building anything** — the
framing differs (that item widens an under-counted basis; this one narrows an over-counted one) but they may
meet in the same helper. If #3317 covers it, resolve this as `graduatedTo` rather than duplicating.

Independently of the basis fix, the second half is worth its own thought: **should a label derived at open be
re-derived when the head moves?** A rebase that removes the triggering file currently leaves the verdict of the
old basis in place.

## Done when

1. **Executable** — a test asserting that a branch which is behind `main` and touches no statute file does
   **not** earn `review:human`, and that one which genuinely edits a statute file still does. Both directions:
   a rule that stops firing is worse than one that over-fires.
2. `npm run check:standards` — 0 errors.
