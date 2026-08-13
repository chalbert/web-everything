---
bornAs: xsz0l4c
kind: story
size: 1
status: open
scaffoldedBy: "loop-console"
dateScaffolded: "2026-08-13"
dateOpened: "2026-08-13"
tags: [measurement, statistics, gate, review, footgun]
scope:
  - we:scripts/lib/gate-health.mjs
  - we:scripts/operations/retry-health.mjs
---

# The sample-size estimator says one observation is enough when the base rate is high

`requiredNPerGroup` answers *"how many observations before a difference of `mdd` is real"*. Above a base rate
of roughly 0.97 it answers **1**:

```
baseRate 0.50 -> 1565      baseRate 0.95 ->  153
baseRate 0.80 ->  906      baseRate 0.98 ->    1
baseRate 0.90 ->  436      baseRate 0.99 ->    1
```

The cause is the clamp. `pbar = min(1 - 1e-6, p + d/2)` reaches 1 once `p + d/2 >= 1`, so `pbar * (1 - pbar)`
collapses to ~0 and the whole numerator vanishes. It is not a rounding artefact — the function is the one that
tells a reader whether they have enough data, and it confidently says a single observation suffices.

Found while checking whether `retry-health`'s floors are large enough to choose #3083's retry default. They
are not, and the helper that was supposed to say so is broken in exactly the range that matters — retry
success rates are expected to be high.

## Why it has survived

Nothing has called it with a base rate that high. `gate-health` uses it on defect rates, which sit far below
0.97, so every shipped call is in the range where the formula behaves. The break is real but has never been
reached — which is also why no test caught it: the tests use realistic defect rates.

## The shape of the fix

The normal approximation is simply invalid near the boundary, so the honest answer is not a bigger number —
it is **no answer**. Return `null` and let the caller report "cannot estimate", which is the discipline this
module already applies to its own verdict. A number that is wrong in a known direction is worse than a
refusal, because a refusal is visible.

`we:scripts/operations/retry-health.mjs` shares the formula and inherits the break; its `MIN_SUCCESSES` floor
of 20 also needs deriving from the estimator rather than being a chosen constant — pinning a 95% coverage
fraction to ±5% needs about 153 observations, not 20.

## Watch for

- Two callers, one formula. Fixing it in one place and not the other re-creates the drift.
- The existing tests use realistic defect rates and will all stay green through the fix; a test at the
  boundary is the point.

## Done when

- [x] The estimator refuses instead of returning a small number it cannot justify.
- [ ] Both callers handle the refusal.

## 2026-08-13 — the estimator is fixed; the second caller does not exist on main yet

`requiredNPerGroup` now returns `null` when `baseRate + mdd > 1`, and `assessCriteria` prints *"no sample size
would detect a 5-point rise from a 97.5% base rate — it would exceed 100%"* instead of a number.

**The condition is not the one this card diagnosed, and the difference matters.** The card blamed the clamp,
which fires at `p + d / 2 >= 1`. Guarding only that would have left a silent zone: at `p=0.96, d=0.05` the
clamp never fires and the old code returned a plausible **93** — for a comparison arm at 1.01, which cannot
exist. A visibly absurd `1` is a better failure than a credible 93. The guard is therefore on whether the
effect being sized is possible at all, not on whether the arithmetic overflows.

**What is NOT fixed, stated plainly.** The low end is untouched. `pbar = p + d / 2` places the comparison arm
above the base rate, so the formula is one-directional by construction and `baseRate - mdd < 0` is outside
what it models. No claim is made about it either way.

**Why the second box stays open.** `we:scripts/operations/retry-health.mjs` is not on `main` — it is still in
PR #1195, which is in its fifth review round and may yet be stood down. Editing it here would collide. The
`MIN_SUCCESSES = 20` floor should be re-derived once that lands: pinning a 95% coverage fraction to ±5% needs
about 153 observations, and the estimator can now be trusted to say so.

Mutation-checked: removing the guard reddens *"refuses instead of answering when a detectable rise would
exceed 100%"* and *"the blocker says no sample size would do"*; disabling only the blocker's null branch
reddens the second alone.
- [ ] A test covers the boundary, not just the comfortable middle.
