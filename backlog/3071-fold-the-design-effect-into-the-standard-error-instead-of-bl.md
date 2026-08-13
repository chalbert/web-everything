---
bornAs: xddemu9
kind: story
size: 3
status: open
dateOpened: "2026-08-11"
tags: [measurement, statistics, gate, review]
scope:
  - we:scripts/lib/gate-health.mjs
---

# Fold the design effect into the standard error instead of blocking on any clustering

`gate-health` refuses to conclude when defect observations share a source commit, because the interval assumes
independent trials and clustered ones are not. The threshold is `any repeated source at all`, which on real
history means `conclusive: true` is nearly unreachable — fix commits routinely touch files from several prior
PRs. Widening the standard error by the design effect removes the cliff and lets mildly-clustered data
conclude, instead of treating a little clustering and a lot the same way.

## Why the blunt version shipped

Two failure modes, and they are not symmetric. A **false conclusive** is silent and would be used to retune the
review parameters — the tool's whole purpose is informing that decision, so a confident wrong answer is the
worst thing it can produce. **Never concluding** is visible, and the blocker line carries the actual counts, so
a reader can see exactly why.

Given that asymmetry the conservative cut was right to ship, and the independent review agreed
(*"acceptable and deliberately conservative"*). But it is a cliff, not a gradient: 20 observations from 19
sources is treated exactly like 20 from one.

## What the correct end-state looks like

Inflate the variance by the design effect rather than refusing outright — roughly `deff ≈ observations /
distinct sources`, so the standard error grows by `√deff` and the interval widens in proportion to how
clustered the data actually is. Mildly-clustered data then concludes with an honestly wider interval; heavily
clustered data still cannot.

That is the same discipline the module already applies elsewhere: report the uncertainty rather than suppress
the answer, and refuse only when the arithmetic genuinely cannot support one.

## Watch for

- `clusterEffectiveN` currently reports `effectiveN = distinct sources`, which is the fully-correlated
  assumption. The design effect needs the cluster SIZE distribution, which that function already computes and
  discards — the data is there.
- The `≥5 successes and failures` usability gate is a separate guard and must stay: a valid design effect over
  an invalid normal approximation is still invalid.
- Whatever lands must keep a mutation test per precondition. Every correction in this module has one, and two
  of them were found decorative by review before they were made real.

## Done when

- [ ] The interval widens with the observed clustering instead of the verdict being suppressed by it.
- [ ] Heavily clustered data still cannot conclude.
- [ ] The blocker line distinguishes "too clustered to conclude" from "not enough observations".

## 2026-08-13 — ATTEMPTED AND STOOD DOWN. Settle the population before writing code again.

PR #1196 tried this twice and was bounced twice, both times for the same defect one level finer: **a
statistic computed over one population and applied to another's decision.**

| round | what was computed over | what the decision used |
| --- | --- | --- |
| 1 | the whole corpus | each size BAND — singletons in bands that never conclude dragged the mean under the limit and cleared the blocker for a band whose own signals were one commit |
| 2 | each band, pooled | a TWO-ARM comparison — escalated vs clean, pooled across both |

Round 2 also shipped an undefended fix (reverting the per-band widening left 47/47 green) and a test whose
assertions sat behind an `if` that never ran.

**Why it was stopped rather than iterated a third time.** This module decides whether the review criteria
work, and its output would be used to retune the gate — a false conclusive is the worst thing it can
produce. The pre-existing behaviour, refusing on any clustering, is blunt and CORRECT. A widening that is
subtly wrong about its population is worse than no widening, and three rounds produced no convergence.

**What the next attempt needs before any code.** Name the population the decision actually uses — a two-arm
proportion comparison — and derive the design effect for THAT, not for a convenient superset. This is a
statistics question, not an implementation one, and iterating on the implementation is what failed.

Related: #3090 — the sample-size estimator in this same module answers `1` above a 97% base rate. Worth
fixing first, since any redesign here will lean on it.

## 2026-08-13 — MEASURED: this change would unblock nothing. Parked, not just bounced.

The stand-down above was argued from the review history. Someone asked the obvious question — *if it is
worth doing, why would a third attempt work?* — so it was measured instead. `assessCriteria` over 500
merged PRs:

```
records: 500        observable share: 0.468 (234 PRs)
baseRate: 2.1%      requiredNPerGroup: 278 per group per band
bandsTested: 0
clustering: 5 observations from 2 distinct sources
BLOCKERS: censoring · clustered observations · insufficient observations
```

**Clustering is one of three blockers and it is not the binding one.** Remove it and the verdict still
refuses, twice over. The binding constraint is sample size: 278 per group × 2 groups × 5 bands ≈ 2,780
observable PRs against the 234 that exist. Off by a factor of roughly twelve, and `bandsTested: 0` says
no band is even testable today.

**The widening would also be computed from 5 observations across 2 sources.** A design effect estimated
from a cluster-size distribution that small is noise. The change would have replaced a blunt refusal with
a precise one derived from nothing.

So the ranking is settled and it is not "do the statistics properly first" — it is **do not do this yet**.
The two failed attempts were not merely wrong about the population; they were work on the least binding of
three constraints. What would actually move the tool is raising the observable share (currently 47%) or
finding a defect signal denser than 2.1%, and neither is this card.

**Reopen when** a band reaches `testable` on its own — at that point clustering becomes the binding
blocker and the design effect has enough cluster sizes to be estimated. Until then the blunt refusal costs
nothing, because the verdict would be a refusal either way.

## 2026-08-13 — PR #1196 is CLOSED

Closed on the measurement above, not on the bounce count. A `review:changes` PR nobody intends to fix
reads to the drain and to any fresh session as work in flight, and this card already holds everything the
PR did.

Nothing is lost by the closure: `lane/design-effect` survives on the remote at `5e46e8d7` (two commits,
+365/−22 across 3 files), and both review rounds stay on the PR. **Reopen the PR rather than re-deriving
it** if the condition above is ever met — though the reopen condition is a data condition, so a fresh
implementation against the settled model is the likelier route.

The item itself is left `status: open` deliberately: the work is still worth doing eventually, and the
"Reopen when" line above is the trigger. It is the PR that was dead, not the idea.

Related: [#3090] fixed `requiredNPerGroup` in this same module, which answered `1` above a 97% base rate.
It does not change the ranking — at the measured 2.1% base rate the estimator was already in the range
where it behaves, so the 278-per-group figure stands.
