---
bornAs: xadzx6f
kind: decision
status: open
dateOpened: "2026-08-16"
tags: [measurement, statistics, gate]
---

# Should requiredNPerGroup fold in this module's own 5-and-5 validity floor?

requiredNPerGroup answers a pure power question; compareProportions separately refuses below 5 successes-and-5-failures per group. Above baseRate ~0.93 the two diverge, so the estimator can say "collect N" and the module still refuses at N. Folding the floor in would change shipped, test-pinned constants.

Spun out of [#3090](/backlog/3090-the-sample-size-estimator-says-one-observation-is-enough-whe/) (`we:scripts/lib/gate-health.mjs`), whose own Done-when named this a "modelling call, not a bug fix" and left it as a box rather than a change made inside a review round. That card's four rounds already did the arithmetic below; this item exists so the call gets made deliberately, with `preparedDate`, rather than folded into a bug-fix round.

## The axis

`requiredNPerGroup(baseRate, mdd)` is the textbook two-proportion power formula — 80% power, α=0.05, two-sided — and nothing else. `compareProportions` (same module) separately refuses to report `separated` unless both groups clear **≥5 successes AND ≥5 failures**, because the normal approximation the whole module rests on is invalid below that. The two criteria are computed from different inputs (a requested effect size vs. two observed counts) and can disagree:

| p | mdd | `requiredNPerGroup` returns | arm at p+d | expected failures in that arm at that n | `compareProportions.usable` at that n |
| --- | --- | --- | --- | --- | --- |
| 0.94 | 0.05 | 212 | 0.99 | 2.12 | **false** |
| 0.93 | 0.05 | 270 | 0.98 | 5.40 | true |
| 0.90 | 0.05 | 436 | 0.95 | 21.80 | true |

At `p=0.94` the estimator says "collect 212 per group", and after collecting exactly that, the same module says "too few observations for a normal approximation". Below `baseRate ≈ 0.93` the two criteria never diverge in the reachable range, so every currently-shipped call site (defect rates, all far below 0.93) has never seen this.

## Option A — fold the floor into `requiredNPerGroup` (bold default)

Return `Math.max(powerN, Math.ceil(5 / Math.min(p, 1 - p, p + d, 1 - (p + d))))` instead of the pure power term. The function then always answers a number that, if collected, is also sufficient for `compareProportions` to consider the result — "how many do I need" and "will the module accept that many" become the same question, which is what a reader instinctively assumes already.

Cost: it **changes shipped, test-pinned constants** — `requiredNPerGroup(0.044, 0.2)` moves from 49 to 114 — because the floor binds even at some base rates well under 0.93 when `mdd` is large (`p + d` is what the floor is keyed on, not `p` alone). Every existing pinned expectation in `we:scripts/operations/__tests__/gate-health.test.mjs` (`toBe(403)`, `toBe(389)`, `toBe(270)`, `toBe(1094)`, `toBe(49)`, `toBe(153)`, …) needs re-deriving against the new formula, not just re-running — a silent value change in a function whose whole purpose is "trustworthy number" is the exact failure mode this card chain has spent four rounds guarding against elsewhere in the same file.

## Option B — leave `requiredNPerGroup` as the pure textbook formula, document the gap (status quo)

Keep the function a direct implementation of the named textbook formula, so any caller who already knows that formula gets exactly what they expect and no more. Document the divergence (already done, at length, in the function's own docstring) and give callers that need both criteria the exact floor expression to apply themselves.

Cost: a caller who doesn't read the docstring can still be told "collect 212" and then be refused at 212 — the UX gap the card opened with is real. It is mitigated, not eliminated, by the fact that the **one live caller** (`assessCriteria` in the same module) does not actually rely on `requiredNPerGroup` to gate anything: it separately computes `testable`/`shortBy` per band from the four raw cell counts and gates the verdict on that, so `power.perBand[].requiredNPerGroup` is informational display text next to `power.perBand[].testable`, never the thing a wrong verdict could hang off. A reader who looks at only the number and not the neighboring `testable` field can still be misled by the display, but the *system* cannot be.

## Recommendation

**Option B**, provisionally — the one caller that exists already fences the actual risk (`testable` gates the verdict; `requiredNPerGroup` does not), so Option A's cost (silently redefining a named textbook function's output, breaking pinned constants) is being paid to fix a UX read of a display field, not a correctness bug. If a second caller arrives that *does* trust `requiredNPerGroup` alone to decide whether to keep collecting — the way `retry-health` (#3083) might — that caller is the forcing function to revisit this, with a concrete second consumer to weigh instead of a hypothetical one. Not ratified here; this card exists to hold the fork open for that deliberate call.
