---
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
---

# Are the review-escalation criteria selecting the right PRs? Make it a measurable operation

Half of all merged PRs carry no review label — they trip none of the four escalation signals and land on green
CI alone. Whether that half is genuinely safe was unanswerable, and the obvious measurement lies. This lands
`gate-health` as a declared operation: it compares escalated against unescalated PRs, corrects for the two
confounds that made the naive version wrong, and returns a confidence interval that refuses to call a
difference real when the sample cannot support one.

## Why it exists

`plateau-app#137` merging unreviewed prompted the question the roster fix (`#xdgei3q`) does not answer: not
*"was that one PR gated?"* but *"are the criteria any good?"*. Measured across the constellation, PRs merging
with **no review label at all** are web-everything 100/200, plateau-app 77/137, frontierui 26/42 — roughly half
everywhere. That is the rubric working as designed (a clean small PR should not park for nothing), but nothing
established whether the unescalated half is actually low-risk.

## The naive measurement, and why it is wrong

Ask "how often is a merged PR followed within 14 days by a fix touching its files?", split by whether it
escalated, and the answer is **23% escalated versus 7% clean** — a tidy 3× signal. It does not survive its own
output:

1. **The follow-ups are the review WORKING, not the PR failing.** The commits it counts are named
   `fix-live-review-findings` and `small-owed-fixes`. An escalated PR gets reviewed, the review finds things,
   and those become fix commits. Counting them credits the criteria for an effect they *caused*.
2. **Escalated PRs are simply bigger** — median 18 changed files against 2, and 1,166 lines against 69. More
   surface means more chance of intersecting any later commit at all.

Both are encoded as corrections in the code, not as caveats in a report nobody re-reads: `classifyFollowUp`
separates review-driven fixes from independent ones and only the latter counts, and `stratifyBySize` bands the
PRs so the comparison happens between like-sized ones.

## And it reports uncertainty rather than a number

Split ~300 PRs into size bands and then into two groups and a cell holds a few dozen. At that n an 8-point gap
is indistinguishable from noise, and a tool that prints `23% vs 7%` invites a parameter change on evidence that
cannot support one. `compareProportions` returns a 95% interval on the *difference* and a `separated` flag true
only when that interval excludes zero — forced **false** when the normal approximation does not hold, because
an interval from an invalid approximation that happens to exclude zero is the most dangerous output this could
produce.

Over the current history the honest verdict is *"no size band has enough observations to support a
comparison"*. That is the finding, not a failure: **the criteria cannot be tuned from this much history**, and
saying so is the feature.

## Why an operation and not a script

Because the question is not asked once. Review parameters are heading for per-project tuning and A/B
comparison, and the arithmetic that decides *"did variant B beat A"* is the same arithmetic that decides *"are
today's criteria any good"*. Declared as an operation it is callable from the command line and over HTTP with
no bespoke endpoint — two `compute` steps, so
[we:scripts/operations/http-adapter.mjs](../scripts/operations/http-adapter.mjs) gives it a `GET`-only surface,
exactly as for `suggest-next`.

## The gap it cannot close, reported in every response

It **cannot attribute an outcome to a parameter set.** The escalation record stamped on a PR carries the reason
strings and nothing else — [we:scripts/lib/review-policy.contract.json](../scripts/lib/review-policy.contract.json)
has a `version` field and no code reads it. A threshold change therefore splits the history into incomparable
halves with no marker at the seam. `assessCriteria` returns `parameterSet: null` with the caveat travelling
beside the numbers rather than in prose, because a web caller renders the numbers. **Retrospective A/B is not
possible until that version is stamped**, and every unstamped day is history that cannot serve as a control.

## Done when

- [x] A review-driven follow-up is not counted as a defect, with the real merge subjects as fixtures.
- [x] The comparison is stratified by size, so an 18-file PR is never compared against a 2-file one.
- [x] A difference is reported only when the interval excludes zero, and never when the approximation is invalid.
- [x] A fixture the naive reading gets backwards proves both corrections are load-bearing.
- [x] An unmeasurable PR is dropped and counted, never scored as "no follow-up".
- [x] The declaration's import graph reaches no `node:` specifier and not the io module.
