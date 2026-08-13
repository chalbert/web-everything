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

> **Both paragraphs below were written when `we:scripts/operations/retry-health.mjs` was expected to land.
> It was deleted instead (PR #1195's split) and re-filed against [#3083]. There is one caller. The "153
> observations" figure is withdrawn — see the 2026-08-13 note.**

`we:scripts/operations/retry-health.mjs` shares the formula and inherits the break; its `MIN_SUCCESSES` floor
of 20 also needs deriving from the estimator rather than being a chosen constant — pinning a 95% coverage
fraction to ±5% needs about 153 observations, not 20.

## Watch for

- Two callers, one formula. Fixing it in one place and not the other re-creates the drift.
- The existing tests use realistic defect rates and will all stay green through the fix; a test at the
  boundary is the point.

## Done when

- [x] The estimator refuses instead of returning a small number it cannot justify.
- [x] A test covers the boundary, not just the comfortable middle.
- [x] Both callers handle the refusal. *(There is only one caller now — see below.)*
- [ ] Decide whether the estimator should also enforce this module's own ≥5-and-≥5 validity rule.

## 2026-08-13 — the estimator is fixed; round 2 moved the boundary and the blocker's population

`requiredNPerGroup` returns `null` when `baseRate + mdd >= 1`, and the "insufficient observations" blocker
now names the band that is actually reachable rather than making a claim from the corpus.

**The condition is not the one this card diagnosed, and the difference matters.** The card blamed the clamp,
which fires at `p + d / 2 >= 1`. Guarding only that would have left a silent zone: at `p=0.96, d=0.05` the
clamp never fires and the old code returned a plausible **93** — for a comparison arm at 1.01, which cannot
exist. A visibly absurd `1` is a better failure than a credible 93. The guard is therefore on whether the
effect being sized is possible at all, not on whether the arithmetic overflows.

**`>=`, not `>` — the first cut of this fix got the boundary wrong.** It returned 153 at `p=0.95, d=0.05` on
the reasoning that "at `p + d === 1` the arm is 1.0, not past it". The arm being exactly 1.0 *is* the
problem: its variance is zero, so there is no normal approximation to invert, and it yields zero failures at
every n — `compareProportions` in this same module would refuse it forever. 153 was the same credible-wrong
number one row down, and this card was telling the next author to derive a constant from it.

**The clamps are gone entirely.** They ran *before* the guard, so the guard tested a different pair than the
caller passed, and disagreed in both directions: `(0.9999999, 1e-6)` was answered although its true sum
exceeds 1, and `(0, 1)` was refused although its true sum is exactly 1. `Number(mdd) || 0.05` also replaced
an explicit `mdd = 0` — reachable from the declared `minDetectableDiff` input, which has no minimum — with a
sample size for a 5-point effect nobody asked about. The function now refuses a step it cannot size.

**The blocker was making a corpus-wide claim about a per-band decision, and that was a regression.**
`baseRate` is pooled across all five bands *and* across both arms; the blocker's sentence asks a per-band
question. The first cut turned a soft under-estimate into a categorical *"no sample size would detect a
20-point rise"*. Demonstrated: 80 records at 98.75% plus 20 at 10% pools to 81% and refuses, while the `xs`
band's own 10% needs 63 per group. The old text said *"~33 per group per band"* — wrong number, right
direction; the categorical version points the wrong way and reads as *"collecting more data is futile"*.

Each band is now sized from its **clean arm** — the formula compares a control at `baseRate` against a
treatment at `baseRate + mdd`, so the control arm's rate is the base rate it means. `power.perBand` carries
one entry per occupied band; `power.baseRate` and `power.requiredNPerGroup` stay corpus-wide and are now
labelled as such.

**What is NOT fixed, stated plainly.** The low end is untouched. `pbar = p + d / 2` places the comparison arm
above the base rate, so the formula is one-directional by construction and `baseRate - mdd < 0` is outside
what it models. No claim is made about it either way.

**The second caller no longer exists.** `we:scripts/operations/retry-health.mjs` was deleted in PR #1195 —
its round-5 review recommended splitting the item, landing the collector and re-filing the reader against
[#3083], and that was accepted. So the advice this card previously gave — *"pinning a 95% coverage fraction
to ±5% needs about 153 observations"* — is withdrawn twice over: that number no longer exists (the boundary
refuses it), and it was the wrong formula anyway. `MIN_SUCCESSES` is a **one-sample precision** question;
`requiredNPerGroup` answers a **two-arm power** question. Deriving one from the other was a category error,
and it belongs on [#3083] with the rest of the reader's modelling.

Mutation-checked, 14 mutations, every one reddening a named test: reverting the boundary to `>`; re-adding
either clamp; restoring either `||` substitution; dropping the finite or domain guard; making the blocker
speak from the corpus again; sizing a band from both arms pooled or from the escalated arm; picking the
hardest band instead of the easiest; inventing a rate for an empty band; inverting the answerable filter;
dropping `perBand` from the payload.

## Still open: should the estimator enforce this module's own validity rule?

The returned n is the **power** requirement and carries no validity floor — the textbook formula has none.
This module's `compareProportions` separately demands ≥5 successes AND ≥5 failures per group, and above a
base rate of about 0.93 the two diverge:

| p | mdd | returns | arm at p+d | expected failures in that arm at that n | `usable` |
| --- | --- | --- | --- | --- | --- |
| 0.94 | 0.05 | 212 | 0.99 | 2.12 | **false** |
| 0.93 | 0.05 | 270 | 0.98 | 5.40 | true |
| 0.90 | 0.05 | 436 | 0.95 | 21.80 | true |

So at `p=0.94` the estimator says "collect 212 per group" and, after collecting 212 per group, the same
module says "too few observations for a normal approximation". Folding the floor in — `n >= 5 / min(p, 1-p,
p+d, 1-(p+d))` — would close it, but it **changes shipped constants**: `requiredNPerGroup(0.044, 0.2)` goes
49 → 114, and the existing test pins those values explicitly as the textbook reference.

That is a modelling call, not a bug fix, so it is a box rather than a change made inside a review round.
Note it does not affect the numbers on [#3071]: at a 2.1% base rate the power term (278) already exceeds the
floor (239).
