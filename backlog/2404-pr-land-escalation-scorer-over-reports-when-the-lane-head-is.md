---
kind: task
status: resolved
dateOpened: "2026-07-10"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
relatedTo: ["2373", "1821", "2365"]
tags: [review, drain, gate-self, pr-land, escalation]
---

# pr-land escalation scorer over-reports when the lane HEAD is behind main (twin of #2373) — two-tree diff vs fresh origin/main counts upstream-advanced files as the PR's changes

The review-escalation scorer computes a PR's `{changedFiles, diffLines}` via a **two-tree** diff
`git diff --numstat origin/main <head>` (`we:scripts/merge-ai-prs.mjs` `computeNetDiffChangedFiles`,
`:551-564` — *"a NET two-tree comparison, content-only and ancestry-independent, deliberately NOT a
three-dot/merge-base diff"*). That basis is only correct when `<head>` has been **rebased onto the current
`origin/main`**. When the head is **behind** main — which the producer path is, because it scores at PR-open
**before** the rebase — the two-tree diff reports every file the *upstream* advanced on since the lane's base
as a difference of *this* PR, in addition to the PR's own changes.

`#2373` fixed the **mirror** failure (a *stale base* — `origin/main` tracking-ref not fresh, under-reporting).
This is its **twin in the other direction**: the base is now guaranteed fresh (the #2373 force-fetch
`+main:refs/remotes/origin/main`), but a fresh, further-advanced base against an **un-rebased head** makes the
over-report *worse*, not better — the fresher the base, the more upstream commits get mis-attributed to the PR.

## Reproduction (real hit — PR #364)

PR #364 was a **2-file docs-only** prep change (a `we:backlog/` decision item + a `we:reports/` report). It was
scored `review:human` with:

```
blast-radius (scripts/__tests__/merge-ai-prs.test.mjs, scripts/merge-ai-prs.mjs, scripts/pr-land.mjs)
gate-self (scripts/merge-ai-prs.mjs) — human review required
size (437 ≥ 400 changed lines)
```

None of those `scripts/*` files are in the PR (`gh pr diff 364 --name-only` → only the 2 docs). The head
commit `93ec7778` was based on the session's `git reset --hard origin/main` point (`e8dd304d`); by scoring
time `origin/main` had advanced (concurrent drains). Reproduced:

```
$ git diff --numstat origin/main 93ec7778     # two-tree, fresh base vs un-rebased head
1  125  scripts/__tests__/merge-ai-prs.test.mjs   # ← upstream-advanced, NOT touched by #364
0   99  scripts/lib/review-core.mjs               # ← upstream-advanced
15  58  scripts/merge-ai-prs.mjs                  # ← upstream-advanced → gate-self false-positive
6   13  scripts/pr-land.mjs                       # ← upstream-advanced
… (many more, incl. every backlog item that landed in between) …
```

The 437-line count and the gate-self hit are entirely upstream commits the head is merely *behind* on — the
diff's second direction (files the head "removes" relative to the advanced base). Cost: an innocent
docs-only PR was parked `review:human`, stalling it until a human ran `/review 364`.

## Why it matters

Over-scoring is the "safe" direction the module deliberately prefers (`:534-535`), but a **false `review:human`
gate** is not free: it defeats the drain's autonomy on exactly the PRs that should sail through (small,
non-code, low-risk), and pulls a human into a conflict-of-interest review that never applied. Any lane that
started more than a few landings ago and hasn't rebased before its producer-scoring is exposed — i.e. most
lanes under an active concurrent drain.

## The fix (one of)

The invariant: **score the diff the PR actually introduces, not the delta between a fresh base and a behind
head.** Options, cheapest first:

- **(a, recommended) Score after the rebase, not before.** In `we:scripts/pr-land.mjs`'s
  `applyReviewEscalationLabel`, rebase/bring the head up to `origin/main` first (the land path rebases anyway),
  then score the rebased head — a two-tree diff of a rebased head vs its base is exactly the PR's own changes.
- **(b) Diff against the head's merge-base, not the base tip.** `base = git merge-base origin/main <head>`,
  then `git diff --numstat <merge-base> <head>` — excludes upstream-only advances by construction while
  staying a two-tree (content) diff, so it keeps #2373's under-report protection (the merge-base is never
  *ahead* of a stale tracking-ref). This is the smallest change to `computeNetDiffChangedFiles` and fixes
  **both** the producer and drain-backstop callers at once.
- **(c) Three-dot `origin/main...<head>`.** Simplest, but the module comment (`:526-528`) rejected three-dot
  for #2373's reasons; (b) achieves the same "only head-unique changes" result while keeping the explicit
  two-tree form, so prefer (b) over (c).

**Test:** extend `we:scripts/__tests__/merge-ai-prs.test.mjs` — a head behind `origin/main` by commits touching
`we:scripts/merge-ai-prs.mjs` must score `changedFiles` = only the head's own files (no gate-self), proving the
#364 shape can't recur.

---

Twin of `#2373` (same scorer, mirror direction — stale base vs. behind head); same net-diff basis as `#1821`;
the sticky-label reporting is `#2365`. Grounded in `we:scripts/merge-ai-prs.mjs:496-564` +
`we:scripts/pr-land.mjs` `applyReviewEscalationLabel`. Surfaced by PR #364 (the `/prepare 2398` land).
