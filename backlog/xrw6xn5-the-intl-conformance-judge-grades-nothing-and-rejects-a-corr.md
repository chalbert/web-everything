---
kind: story
size: 2
status: resolved
dateOpened: "2026-08-11"
dateStarted: "2026-08-11"
dateResolved: "2026-08-11"
tags: [conformance, intl, cross-repo, gate, vectors]
scope:
  - we:conformance-vectors/intl.vectors.ts
  - plateau:packages/core/src/conformance-engine/conformanceVectors.ts
  - plateau:packages/core/src/conformance-engine/intl.conformance.test.ts
---

# The intl conformance judge grades nothing and rejects a correct answer

The first graded run of the intl suite found the provider correct on all five vectors and the harness unable to
say so in either direction: three vectors accepted **any** input, and two rejected a correct one. Both halves
are fixed here — the judge reads the shape the binding actually emits and fails closed on anything else, and
the collator vectors tag `exact` instead of `predicate`. A cross-repo couple, verified green end to end.

## The two defects

**Three vectors graded nothing.** `partsStructureEqual` read `.parts` off both sides. The intl vectors and the
binding exchange **bare arrays**, so `.parts` was `undefined` on each, both collapsed to `[]`, and
`[].every(…)` returns true unconditionally. Proven rather than inferred: a binding reporting
`['totally','wrong','sequence']` passed all three.

**Two vectors rejected a correct answer.** The collator vectors wrote `expect: { sign: -1, matchers: { sign:
'predicate' } }` — a bare scalar. `evalPredicate` requires a `{ predicate, value }` descriptor and fails closed
on anything else, so the finding read, in as many words, `expected -1, observed -1`.

Neither side could express "this scalar sign is −1": the judge's only sign form is `sign-order`, which needs an
array, and the binding observes a scalar.

## Why the fix is split this way

The judge widens to accept **either** shape — a bare sequence or a `{ resolvedOptions, parts }` fragment — and
returns `null` for anything else so the caller fails closed. Silently comparing two empty lists is what made
the vacuous pass possible, so an unreadable shape must be a refusal, not a match.

The vectors switch to `exact`, because that is what they mean. The binding already normalizes `compare()` to a
sign, so `exact` compares exactly that. Widening `predicate` to accept a bare scalar was the alternative and is
worse: its fail-closed-on-unknown-shape behaviour is the property that makes a typo'd matcher an error rather
than a silent pass.

## Landed as a three-step switch, not a flag day

`plateau` resolves WE's vectors from the sibling checkout at `main`, so either half alone leaves the other repo
red. Rather than accept a red window, the sequence widens, switches, then narrows:

1. **This item's plateau half** — the judge fix, plus a test that tolerates *exactly* the two known lag
   findings. Green against WE both before and after the switch; verified in both states.
2. **This item's WE half** — the vector matcher change.
3. **Owed follow-up** — delete the tolerance list and assert zero findings outright.

The tolerance cannot rot into a blanket pass: anything outside the two named strings still fails, and both
vacuity controls run unconditionally.

**THE SAFETY IS ORDER-DEPENDENT, and an earlier draft overstated it as "no red window in either direction".**
The reviewer ran the orders rather than reasoning about them:

| order | result |
| --- | --- |
| plateau first (what the manifest enforces: impl-first, WE-last) | green at every point |
| **WE first** | **plateau `main` goes RED** — 2 failures, the canary inverts and the frozen-findings assertion breaks |
| plateau lands, WE abandoned | green indefinitely; the suite still grades, wrong sign still caught |
| **WE lands, plateau abandoned** | **plateau `main` red — WE must not land alone** |

So the couple is safe *because* the drain enforces impl-first, not because the change is order-independent. The
manifest listing `plateau-app` before `we` is load-bearing, and this item should not be read as saying
otherwise.

## The controls are the point

A suite that passes everything is indistinguishable from a suite that grades nothing — which is precisely what
these three vectors did. So the grader now carries two deliberately-wrong bindings:

- a wrong part-type sequence **must** produce three findings;
- a reversed sign **must** produce two.

Both were run against the fixed harness and both catch. Without the second, tagging the vectors `exact` could
have been wrong in the other direction with nothing to notice.

## What this establishes — and it is NOT what the first draft claimed

With both halves applied the suite returns **zero findings** against FUI's real provider, and both controls
still bite.

An earlier draft called that *"the first end-to-end proof that a real implementation satisfies a WE contract
through the neutral runner"*. **That is false**, and it is the second time today the same overclaim was made
after being corrected: `deck`, `webpolicy` and `webcompliance` already assert zero findings against real FUI
implementations through this same runner. The grading agent said so this morning, in as many words, and the
claim was repeated anyway.

What is actually new is narrower and more interesting: **this is the first suite shown to have been VACUOUS and
then made real.** The other three were written and passed. This one passed for a year without grading anything,
and the only reason anyone found out is that someone finally ran it and read the findings rather than the exit
code. The transferable lesson is not about intl — it is that a green conformance suite is not evidence until
something has proven it can go red.

## Done when

- [x] A bare part-type sequence is compared; an unreadable shape fails closed rather than matching vacuously.
- [x] The collator vectors state their intent with the matcher that means it.
- [x] A wrong sequence and a reversed sign are each caught, asserted as controls.
- [x] Both repos are green before and after the switch, verified in both states rather than reasoned about.
