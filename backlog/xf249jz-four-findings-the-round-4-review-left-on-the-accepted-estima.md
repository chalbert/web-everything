---
kind: task
parent: "3090"
status: open
dateOpened: "2026-08-13"
tags: [measurement, statistics, gate, review, footgun]
scope:
  - we:scripts/lib/gate-health.mjs
  - we:scripts/operations/__tests__/gate-health.test.mjs
  - we:backlog/3090-the-sample-size-estimator-says-one-observation-is-enough-whe.md
---

# Four findings the round-4 review left on the accepted estimator fix

[#3090](3090-the-sample-size-estimator-says-one-observation-is-enough-whe.md) is the sample-size estimator in
`we:scripts/lib/gate-health.mjs`. PR #1203 fixed it after four review rounds, each finding the last round's
fix was a narrower instance of the same defect. The round-4 review accepted the PR rather than bouncing a
fifth time, but carried six findings onto this card. Its own reasoning: the remainder is "a shrunken-but-open
tail of the recurring class, two false explanations in prose, and two coverage nits — all of them edits to a
pure function, a string, and comments, none of them unrecoverable."

## 1. MODERATE — `sizeableMdd` probes the wrong point, and the comment states the wrong reason

`we:scripts/lib/gate-health.mjs:329` (`const sizeableMdd = requiredNPerGroup(0, mdd) !== null;`), and the
claim at `:327-328` (repeated at `we:backlog/3090-the-sample-size-estimator-says-one-observation-is-enough-whe.md:174-175`):
`baseRate: 0` is claimed to be "the canonical probe: at zero the only reasons left to refuse are `mdd`'s
own." That is false — case 4's refusal boundary is a *joint* property of `baseRate` and `mdd`, and `p = 0`
is where it bites latest, not earliest. The reviewer's binary search:

```
p=0          refuses for mdd below ~1e-161.8    <-- the probe point
p=0.5        refuses for mdd below ~1e-153.8    <-- ~8 decades later than the probe
```

Over roughly that ~8-decade window of `mdd`, an `assessCriteria` run can come back with every power figure
`null`, `verdict.blockers` empty, and nothing anywhere saying why — the exact state round 3 bounced for.
Undefended: probing at `requiredNPerGroup(0.5, mdd)` or at the corpus `baseRate` instead of `0` leaves the
whole suite green (167/167).

## 2. MODERATE — the mechanism is stated wrong in three places, including the string an operator reads

`we:scripts/lib/gate-health.mjs:217-218` (docstring case 4), `:254` (the guard's own comment), and
`we:backlog/3090-the-sample-size-estimator-says-one-observation-is-enough-whe.md:167-168` all say the same
wrong thing: *"`d * d` underflows to 0 below about `mdd = 1e-160`."* Checked directly at `p = 0.5, d =
1e-155` — a pair the module refuses — `d * d` is `1e-310`: subnormal, not zero. The refusal is caused by
the **division** overflowing to `Infinity`, not by `d * d` underflowing to `0`, and it starts around
`1e-154` — roughly seven orders of magnitude earlier than the docstring's `1e-160` claim, and by a
different mechanism entirely. The operator-facing blocker at `:334` inherits the same wrong claim in its
actionable half ("far enough above 0 that its square does not underflow") — a caller at `mdd = 1e-155` is
told their square underflowed when it did not.

**This is the same defect class the PR spent four rounds on, not a cosmetic nit.** Findings 1 and 2 both
describe a mechanism wrongly in prose — a code comment (finding 1), and a docstring, a guard comment, the
backlog card, and an operator-facing blocker string (finding 2) — while the surrounding code is otherwise
correct. Rounds 1–3 were bounced repeatedly for exactly this shape: a sentence claiming more than the code
underneath it delivers. It must not be filed as a wording nit.

## 3. MINOR — the PR body is stale and describes a payload field the head no longer has

`gh pr view 1203 --json body` still tells round 3's story. It advertises `power.perBand` as carrying a
`smallestCell` field, which the round-4 head commit removed (replaced by `shortCells`), and describes none
of round 4's four changes. `we:backlog/3090-the-sample-size-estimator-says-one-observation-is-enough-whe.md:120`
carries the same stale `smallestCell` claim in the present tense. Anyone reading either the PR or the card
to understand the shipped shape reads round 3's payload description against round 4's code.

## 4. MINOR — this round removed the only test that pinned `d <= 0`

`we:scripts/lib/gate-health.mjs:249`. Mutating `if (d <= 0 || …)` to `if (d < 0 || …)` now leaves 167/167
green; it reddened 2 tests in round 3. The new result guard (finding 1's `Number.isFinite` check) catches
`0` and `-0` through the same null path that `d <= 0` used to own, so nothing distinguishes which guard
produced the `null` anymore. The docstring still states `mdd <= 0` as a refusal in its own right, so the
boundary needs a test that only that guard can satisfy — or the docstring should say `mdd < 0` and let the
result guard own zero.

## 5. MINOR — carried from round 3, still unaddressed: ties in "closest" are silent

`we:scripts/lib/gate-health.mjs:378`. Mutating the tie-break reduce (`<` → `<=`, tie goes to the *last*
band instead of the first) leaves 167/167 green. Constructed fixture: bands `m` (cells 4/9/9/9) and `xs`
(cells 9/9/9/4), both at `shortBy: 1` — the blocker names only `m` ("closest is band `m`, 1 observation(s)
short..."), even though `xs` is exactly as close. The sentence reads as naming a unique answer; it is not
pinned to be one, and no fixture defends the tie-break's determinism.

## 6. NIT — two lines carrying no tested weight

`we:scripts/lib/gate-health.mjs:369`. Removing both `Object.freeze` calls on `shortCells` and its members
leaves 167/167 green — harmless, but the PR's own standard is that a redundant line no input can reach is a
line no test can defend. Separately, in `we:scripts/operations/__tests__/gate-health.test.mjs`, the
assertion `expect(JSON.stringify({ n: Infinity })).toBe('{"n":null}')` is a tautology about the language: no
state of this diff can make it fail.

## Done when

- [ ] `sizeableMdd` probes where the decision is actually made (not at `baseRate: 0`), and the wrong
      "canonical probe" claim is gone from the comment and from the card (finding 1).
- [ ] The docstring, the guard's comment, and the operator-facing blocker string all describe the real
      mechanism (division overflow, not `d * d` underflow) and the right order of magnitude (finding 2).
- [ ] The PR-body-shaped staleness is fixed at its remaining home: the card's `smallestCell` reference is
      corrected to `shortCells` (finding 3).
- [ ] A test exists that only the `d <= 0` guard (not the result's `Number.isFinite` check) can satisfy
      (finding 4).
- [ ] A tie fixture (or a word in the sentence) makes the "closest band" tie-break's determinism explicit
      (finding 5).
- [ ] The dead `Object.freeze` calls and the tautological `JSON.stringify({n: Infinity})` assertion are
      either justified or dropped (finding 6).
