---
bornAs: xk6uben
kind: story
size: 3
status: resolved
dateOpened: "2026-08-11"
dateStarted: "2026-08-11"
dateResolved: "2026-08-11"
tags: [gate, review, drain, operations, measurement, statistics]
scope:
  - we:scripts/lib/gate-health.mjs
  - we:scripts/operations/gate-health.mjs
  - we:scripts/operations/gate-health-io.mjs
  - we:scripts/operations/run.mjs
---

# Can the merge history show whether the escalation criteria pick the right PRs? Measure that, honestly

Half of all merged PRs carry no review label. `gate-health` lands as a declared operation that asks whether
the history can settle the question — and reports what blocks an answer when it cannot. Against this repo it
returns *cannot conclude*, naming two blockers: only 23% of PRs have a closed follow-up window, and at a 4.4%
defect base rate roughly 404 PRs per group per band would be needed. That verdict is the finding.

## Why it exists

`plateau-app#137` merging unreviewed raised the question the roster fix (`#3065`) does not answer: not *"was
that one PR gated?"* but *"are the criteria any good?"*. PRs merging with **no review label at all**:
web-everything 100/200, plateau-app 77/137, frontierui 26/42. That is the rubric working as designed — a clean
small PR should not park for nothing — but nothing established whether the unescalated half is actually safe.

## The naive measurement lies, four different ways

Ask *"how often is a merged PR followed within 14 days by a fix touching its files?"*, split by escalation,
and you get **23% versus 7%**. Every one of these corrupts it:

1. **The follow-ups are the review WORKING.** They are named `fix-live-review-findings`. An escalated PR gets
   reviewed, the review finds things, those become commits. Counting them credits the criteria for an effect
   they caused.
2. **Escalated PRs are bigger** — median 18 changed files against 2 — so they intersect more later commits
   regardless of quality.
3. **Censoring, and it is differential.** The 300-PR window spans about the same time as the 14-day follow-up
   window, so only 23% of PRs could have shown a follow-up at all. Escalated PRs are much younger (median
   3.8 days vs 9.3), so the missing observations are not missing at random.
4. **The observations are clustered.** Defect signals trace back to a handful of fix commits — one touching
   thirty files marks thirty PRs from a single event. The binomial interval over the raw count is far too
   narrow.

The first two were corrected in the original build. **The second two were found by independent review and are
the reason this item was reworked.** All four are now preconditions the tool evaluates and reports, and each
has a mutation test: remove the correction and a named test goes red.

## What it answers instead

Not *"are the criteria good?"* but **"can this data answer that, and what would it take?"** — because review
established that the honest answer to the first question is unavailable and will stay unavailable. At the full
997-PR history there are still zero usable bands. The binding constraint is the ~3-4% defect base rate, not the
window, so *"collect more history"* was unactionable advice.

So the verdict names blockers, and the power calculation gives the number that makes it actionable: at the
observed base rate, detecting a 5-point difference needs ~404 observations **per group, per band**. That says
the metric is the constraint, not the patience.

## Also fixed, from the same review

- **It was registered nowhere.** `resolveOperation('gate-health')` threw, so the "callable from the command
  line and over HTTP" claim was false — a declaration nothing can reach is a script with extra steps.
- **The headline stated a direction it never checked.** `separated` is symmetric; the summary always said
  escalation correlates with defects. Fed data where unescalated PRs were worse, it printed that anyway. The
  comparison now reports `direction`, and the summary names which group is worse.
- **No multiplicity control.** Five band tests at α=0.05 is a family-wise error near 25%. Corrected across the
  bands actually testable — an empty band is not a test.
- **Two overstatements retracted.** The fixture claimed to make "the uncorrected reading get the answer
  backwards" never flipped the verdict, and the hot-file floor documented at length can never bind at the
  sizes the reader actually reads.

## Its own stated limit

It **cannot attribute an outcome to a parameter set**. The escalation record carries reason strings only;
[we:scripts/lib/review-policy.contract.json](../scripts/lib/review-policy.contract.json) has a `version` field
that nothing reads. A threshold change splits the history into incomparable halves with no marker at the seam.
`parameterSet: null` and its caveat ride **with the numbers**, because a web caller renders numbers rather than
prose. Retrospective A/B is impossible until that version is stamped.

## Done when

- [x] Registered, so it is callable rather than merely declared.
- [x] All four confounds are preconditions, each with a mutation test that reddens when the correction is removed.
- [x] The verdict names its blockers and gives the required-n that makes them actionable.
- [x] The summary reports which group is worse, not one direction regardless.
- [x] The clock is injected, so a given history plus a given time always yields the same assessment.
