---
bornAs: xbjb2w9
kind: story
size: 1
status: resolved
scaffoldedBy: "loop-console"
dateScaffolded: "2026-08-13"
dateOpened: "2026-08-13"
dateStarted: "2026-08-13"
dateResolved: "2026-08-13"
tags: [plateau-loop, operations, engine, dispatch, follow-up]
scope:
  - we:scripts/operations/run-record.mjs
  - we:scripts/operations/effect-executor.mjs
  - we:scripts/operations/cli-adapter.mjs
  - we:scripts/operations/__tests__/run-store.test.mjs
---

# A handle with no visible character passes as pollable

#3081 refused an empty handle and then a blank one, because whitespace is truthy and was being bucketed
`running`. `.trim()` closed that. It does not close a **zero-width space**, which is truthy *and* survives
trimming:

| handle | refused before | refused now |
| --- | --- | --- |
| `''`, `'   '`, `'\t\n'` | yes | yes |
| `'​'` (zero-width space) | **no** | yes |
| `' sess-a '` (padded) | no | no — it is pollable |

An invisible handle lands in exactly the failure the previous fix targeted: bucketed `running` by
`inFlightEntries`, treated as observable by the replay guard, and the operator told to poll it.

Named by PR #1185's reviewer, who probed the validator directly.

## The shape of the fix

The test is "has a VISIBLE character", not "is non-empty after trimming" — and it is asked in ONE place, so
the validator and the constructor cannot drift. That drift was the framing of the last fix ("the validator was
looser than the constructor"), and it is worth removing the possibility rather than re-aligning them a third
time.

`' sess-a '` stays valid: it is genuinely pollable, and `inFlight()` normalizes it on the way in.

## Done when

- [x] A handle with no visible character is refused, however truthy it is.
- [x] The validator and `inFlight()` ask the same question, in one place.

## How it resolved

`isPollableHandle` in `we:scripts/operations/run-record.mjs`, called by both the validator and `inFlight()`.
It tests for a visible character rather than for non-empty-after-trim, so the zero-width space, the
non-breaking space, the BOM and the ideographic space are all refused.

Two mutations reddened named tests: reverting to `.trim()`, and letting `inFlight()` ask a different question
from the validator — the second is what makes "in one place" a property rather than a coincidence.

Also folded in, from the same review: `outcomePayload`'s two lines disagreed about whether `run.effects`
needed a null guard. It never does — `validateRunRecord` requires an array and `newRunRecord` always sets one
— so both are bare now.
