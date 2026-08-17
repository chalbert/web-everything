---
kind: decision
status: open
dateOpened: "2026-08-17"
relatedTo: ["3143", "3090"]
tags: [measurement, statistics, gate]
---

# Should compareProportions offer a small-sample-valid method instead of refusing below 5-and-5?

The 5-and-5 refusal in `compareProportions` (`we:scripts/lib/gate-health.mjs:153`) is a property of the
**normal approximation** the function chose, not of the comparison itself. The
[#3143](/backlog/3143-should-requirednpergroup-fold-in-this-module-s-own-5-and-5-v/) prior-art survey found
that the documented remedy for a failed approximation is a **different test** — Fisher exact, the N−1
chi-squared (Campbell 2007), mid-*p* (Agresti 2001), or Agresti–Caffo, which is statsmodels' own default for
`test_proportions_2indep` — and that exact methods generally need **fewer** observations, not more (PASS:
521 vs 524 per group). So the module may be refusing to read out measurements it could legitimately read
out. Un-prepared; filed so the finding is not lost.

## Why this is filed separately from #3143

#3143 rules on what `requiredNPerGroup` *returns* and on where the validity floor is *published*. Both of
its defaults hold under the method that ships today, so this question does not gate it. But it does bound
the lifetime of #3143's answer: if `compareProportions` gains a small-sample-valid method, the floor #3143
publishes retires with the approximation it describes. That coupling is a reason to keep the two visible to
each other, not a reason to fold them into one call.

## What a prep pass would have to settle

- Is this a **config dimension** rather than a fork? statsmodels exposes `method=` on the test, which is the
  composability probe's obvious success case — several legitimate end-states of one knob, not two rival
  branches. Run that probe first; it may dissolve the whole item to "add a `method` option, pick the
  flavor default."
- If it *is* a dimension: which method is the default — keep `normal` (no behaviour change, opt in to the
  rest) or move the default to `agresti-caffo` (statsmodels' choice, and the one that stops refusing on
  small cells)?
- What happens to `usable` / `separated` / the `too few observations` note, all of which are written in the
  normal approximation's vocabulary (`we:scripts/lib/gate-health.mjs:153,167,172`), and to `assessCriteria`'s
  `testable` / `shortBy` / `shortCells`, which mirror the same 5-and-5 rule in counts
  (`we:scripts/lib/gate-health.mjs:355,365-369`).
- Whether the exact route can even produce a planning number: Stata states that sample size for Fisher's
  exact test is "difficult to compute directly because of the discrete nature of the sampling
  distribution," so adopting an exact method may leave the planning side with no n at all.

## Done when

1. The item reaches Definition of Ready — either as a dissolved config dimension with a named flavor
   default, or as a `## Fork N` with options, a bold default, a `Skeptic:` line and a `Screen:` line — and
   carries `preparedDate`.
