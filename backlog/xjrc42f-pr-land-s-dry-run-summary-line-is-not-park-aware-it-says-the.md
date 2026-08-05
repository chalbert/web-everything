---
kind: task
status: open
dateOpened: "2026-08-05"
scope:
  - we:scripts/pr-land.mjs
  - we:scripts/__tests__/pr-land.test.mjs
tags: [pr-land, drain, park, review, dx]
---

# pr-land's dry-run summary line is not park-aware — it says the drain will land a PR that is actually held

A dry-run with --park=review:pending prints the plan steps correctly (skip check-wait, add the review label, STOP — HELD) but its one-line detail summary still reads 'would open+label HEAD (sha) as a self-approved PR from ref — the drain lands it onto main'. An operator reading only the summary concludes the PR will auto-land when it will actually sit parked. Cosmetic — the plan array is correct and the real run behaves correctly — but the summary is the line a human reads before approving.

## The defect

[`we:scripts/pr-land.mjs:604`](scripts/pr-land.mjs) builds the `detail` string from `PLAN.triggerDrain`
alone and never checks `PLAN.mode === 'park'` — two lines after the `plan` array is built park-aware. So the
two outputs of the same dry-run disagree with each other.

Observed 2026-08-05 opening PR #1050:

```
pr-land […] · dry-run: would open+label HEAD (da318f4b) as a self-approved PR
             from lane/pr-land-park-is-the-hold — the drain lands it onto main
```

while the same run's `--json` `plan` array was correct:

```
"(--park: skip check-wait — the PR is HELD for review, not landed by this run)"
"gh pr edit <pr> --add-label review:pending   # #2622 PARK — … the PR is HELD"
"(--park: STOP — the PR is HELD review:*; a human clears it via /review, then the drain lands it)"
```

The real (non-dry-run) invocation was correct throughout: `parked (review — held, not landed)`.

## Why it is worth a card

`--park` is the ONLY way to hold a PR for a human — `--no-wait` is not, because `shouldLabelOnGreen` (#2216)
labels any producer-owned AI PR `ready-to-merge` the instant CI goes green and the resident drain daemon
lands it. So the dry-run is the moment an operator confirms a diff will be *held* rather than auto-landed,
and it is exactly that moment where the summary line asserts the opposite. Small fix, but it misinforms at
the decision point.

## Residue of #2622, not a duplicate

[#2622](/backlog/2622-pr-land-park-mode-open-a-review-human-pending-pr-without-str/) (park mode, resolved
2026-07-27) states in its Progress section that "Dry-run plan renders park-aware lines" — true of the `plan`
array, silent on `detail`. This is the unclaimed half of that claim.

## Done when

- A `--park` dry-run's one-line summary says the PR is **held for review**, not that the drain lands it.
- A test in `we:scripts/__tests__/pr-land.test.mjs` asserts the `detail` string differs between park and
  non-park mode, so the two dry-run outputs cannot disagree again.
