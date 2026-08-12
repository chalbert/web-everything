---
bornAs: xz6oya5
kind: story
size: 2
status: resolved
dateOpened: "2026-08-11"
dateStarted: "2026-08-11"
dateResolved: "2026-08-11"
tags: [gate, review, drain, measurement, provenance]
scope:
  - we:scripts/lib/review-policy.mjs
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/__tests__/review-escalation.test.mjs
---

# Stamp which parameter set scored a PR, so escalation records are attributable

An escalation record says what fired and never which rules were in force. The contract has carried a `version`
since it was written and nothing read it, so changing a threshold splits the history into two incomparable
halves with no marker at the seam. The reason block now carries the version **and a digest of the contract
text**, and the digest is the field to group by.

## Why it matters now

Per-project review parameters and A/B comparison both need one thing before anything else: the ability to
attribute an outcome to the parameters that produced it. Without it there is no control group — only a
timeline with an invisible discontinuity wherever a threshold moved.

It is already biting. [we:scripts/lib/gate-health.mjs](../scripts/lib/gate-health.mjs) reports
`parameterSet: null` with a caveat saying retrospective A/B is impossible, because there is nothing to read.
Every unstamped day is history that cannot later serve as a control.

## Two fields, because the version alone is not enough

`version` is declared by hand and **nothing forces a bump** when the contract changes. A stamp reading `v1`
across edits that moved the thresholds is worse than no stamp: it asserts "same parameters" where they
differed. So the record also carries a digest of the contract's bytes, which changes whenever the contract
does with no discipline required.

The version stays because it is what a human reads and cites. The digest is what an analysis groups by. The
test pins the digest against an independently-computed hash of the file and asserts that a one-character edit
moves it — so if the stamp ever stops tracking the thing it exists to track, that is red.

Hashing the raw text rather than a canonicalized parse is deliberate: the contract's own stated test is *"did
this file change?"*, and the trust chain gates it on exactly that.

## An unstamped body must stay distinguishable

`parsePolicyStamp` returns `null` for a body with no stamp — every PR opened before this shipped. Defaulting
those to "the current set" would silently claim old PRs were scored under today's rules, which is the same
false-attribution the stamp exists to prevent. Pinned by test.

An unescalated PR gets no reason block and therefore no stamp, which is correct: there is no escalation
decision to attribute.

## What this does NOT do

It stamps from here forward. It cannot retroactively attribute the existing history, and nothing can — that
information was never recorded. So the first honest comparison window opens today, not backwards.

## Done when

- [x] The reason block carries the parameter set, greppable and parseable.
- [x] The digest is derived from the contract text, and a change to the contract moves it.
- [x] An unstamped body reads as unknown, never as the current set.
- [x] An unescalated PR is not stamped.
