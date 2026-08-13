---
bornAs: xddemu9
kind: story
size: 3
status: resolved
dateOpened: "2026-08-11"
dateStarted: "2026-08-13"
dateResolved: "2026-08-13"
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

- [x] The interval widens with the observed clustering instead of the verdict being suppressed by it.
- [x] Heavily clustered data still cannot conclude.
- [x] The blocker line distinguishes "too clustered to conclude" from "not enough observations".

## How it resolved

Kish's design effect over the ACTUAL cluster-size distribution — `deff = Σmᵢ² / Σmᵢ` — rather than the source
count. The weighting is the whole point: it is dominated by the large clusters, which are the ones that
destroy independence.

Measured on the two cases the item names:

| corpus | sources | deff | concludes? |
| --- | --- | --- | --- |
| 20 observations from 19 commits | 19 | 1.1 | yes — the case the cliff killed |
| 20 observations from 2 commits | 2 | 10.0 | no, still |

The sharpest demonstration is a pair with the SAME observation count and the SAME source count — ten from
five, as 2+2+2+2+2 versus 6+1+1+1+1 — landing at deff 2 and deff 4, on opposite sides of the limit. Counting
sources cannot tell those apart at all.

`compareProportions` widens by `√deff`, defaulting to 1 so every existing caller is byte-identical, and
`assessCriteria` passes the corpus-level effect to each band. ρ = 1 is still assumed, the conservative end:
nothing here makes clustered data look better than it is.

`MAX_DESIGN_EFFECT = 2` keeps the refusal — past that the interval is so wide it reports nothing — and the
blocker now says *"more observations from the same commits will not help; more SOURCES will"*, which is the
distinction the old line lacked.

Six mutations reddened named tests. The one worth noting is that computing the effect correctly and never
PASSING it to the interval left everything green until a test drove `assessCriteria` end to end — the feature
would have been absent with every measured claim still true.
