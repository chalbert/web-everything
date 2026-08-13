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
one entry per occupied band; `power.baseRate` and `power.requiredNPerGroup` stay corpus-wide.

## Round 3 — the sentence stopped fusing, because patching it kept moving the defect

Rounds 1 and 2 each fixed one fusion inside the blocker and created another. Round 2 inferred a **reason**
from a `null` it never checked: `requiredNPerGroup` refuses for four distinct reasons, and a negative
`minDetectableDiff` made every band null at once and lit the categorical branch with *"every band's clean
arm is already within -5 points of 100%"* — printed beside a payload showing a band at 10.0%, and strictly
worse than the visibly-absurd huge number `main` printed for the same input. Same class, new place, twice.

**The model error was the sentence.** One string carried a validity fact, a power estimate, a corpus rate,
a band rate and a categorical impossibility claim — five things, three populations, two criteria. Per
`we:docs/agent/delivery-loop.md`, three rounds on one class means the model is wrong, so:

- the blocker states **only** what `!testable.length` establishes — a validity fact, in pure counts, with
  no rate and no modelled number anywhere in it;
- *"how far off"* is a **deficit** against the 5-and-5 rule, which is what "nearest" means and is countable
  without any model. Round 2 ranked on the smallest *requirement* and called the winner "the nearest band":
  a band **one observation** from clearing the bar lost to one needing ~53 more PRs per arm, so an operator
  following the sentence did about 106 PRs of work instead of 1;
- an `mdd` that cannot be sized is **its own blocker**, naming the input, never a claim about bands;
- `power.perBand` now carries `testable`, `shortBy` and `smallestCell` beside `requiredNPerGroup`, because
  a band can exceed its sample-size requirement in both arms and still not be testable — publishing the
  first without the second is what let a reader conclude *"collect 95 and the blocker clears"*.

**And the round-1 `mdd = 0` fix landed one layer below where the substitution happened.**
`we:scripts/operations/gate-health.mjs` ran its own `Number(...) || 0.05` before `assessCriteria` ever saw
the zero, so the library's refusal was unreachable from the only shipped surface that produces the input —
the fix looked done while the operator's symptom was byte-identical. The value is now passed through; the
schema still supplies the default when the field is absent.

The guard also stopped coercing. `Number(null)` and `Number([])` are both `0`, so a base rate nobody
supplied was silently replaced and answered 153 — the same substitution this card says was removed,
surviving through `Number()` instead of through `|| 0`. It is a `typeof` check now, with one stated
exception: an omitted `mdd` takes the documented default.

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

## Round 4 — ordinary bugs inside the new model, not the model again

Round 3's reviewer ran 67 mutations and said plainly **not to re-open the model**: the fixes below are an
arithmetic change and a deletion, and the model's own rules are what name them as wrong. Recorded because
the distinction is the useful part — *"the model is wrong"* and *"the code does not implement the model"*
call for different next steps, and three rounds were spent learning that.

**The deficit counted ONE cell and was ranked as the whole distance.** `shortBy` took the single smallest
cell, so a band at 4/4/4/4 reported "1 short" and a band at 3/10/10/10 reported "2 short" — and the blocker
named the first. The reviewer followed it literally: adding one observation there left `bandsTested: 0` and
the blocker still firing, while adding two to the band it did **not** name cleared it. Testability needs
every cell at 5, so the distance is the **sum** of the four shortfalls. `shortCells` now lists each short
cell with what it holds, and the blocker names them all.

**Removing the clamps introduced an `Infinity`.** With `Math.max(1e-6, …)` gone from `mdd`, `d * d`
underflows to 0 below about `1e-160` and the division returns `Infinity` — impossible on `main`, created by
round 3. Worse than a wrong number: `Infinity` has no JSON representation, so an HTTP caller received
`null` with no blocker explaining it. The guard is on the **result**, not a re-added input clamp, so the
"arguments as passed" promise stays true. That is a fourth null case and the docstring says so.

**`sizeableMdd` restated the estimator's rules instead of asking it, and drifted within one round.** It
now probes — `requiredNPerGroup(0, mdd) !== null` — because at a zero base rate the only reasons left to
refuse are `mdd`'s own. A copy of a rule cannot drift when there is no copy.

**Two sentences that were still wider than the code.** *"No power figure below is populated, and that is
the reason"* was false in both halves — `power.baseRate` **is** populated, and a band with an escalated arm
but no clean arm is null because it has no rate, not because of the `mdd`. Deleted. And the blocker written
to *name* the offending input printed *"`minDetectableDiff` is null"* for `NaN`, `Infinity` and
`-Infinity`, because `JSON.stringify` renders all three as `"null"` — which names nothing and reads as a
missing value rather than a rejected one. `String` now.

Seven mutations survived round 3 and all seven redden now: swapping either clean cell's label, dropping
either clean cell, an off-by-one in the shortfall, loosening `>= 5` to `> 5`, and ranking on `bandNeeds[0]`.
A band with one arm and no other had no coverage at all and now has its own test.

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

**Which of the two binds depends on `mdd`, and `minDetectableDiff` is a caller input, so no unconditional
claim is made about [#3071].** At that card's measured base rate the two are computed from the same rate
(`5 / 234 = 0.02137`, not the rounded 2.1% — an earlier version of this paragraph compared a power term
from one rate against a floor from the other and presented it as one comparison):

| mdd | power term | floor `⌈5/p⌉` | binds |
| --- | --- | --- | --- |
| 0.05 | 278 | 234 | power |
| 0.10 | 104 | 234 | **floor** |
| 0.20 | 42 | 234 | **floor** |

So at #3071's default the floor does not bind and its 278 stands. At a larger requested effect it would.
