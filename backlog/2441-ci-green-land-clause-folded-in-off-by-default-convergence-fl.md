---
bornAs: xesrmcc
kind: story
size: 3
parent: "2410"
status: resolved
blockedBy: ["2438", "2439", "2440"]
dateOpened: "2026-07-11"
dateStarted: "2026-07-27"
dateResolved: "2026-07-28"
tags: []
scope:
  - we:scripts/lib/jury-core.mjs
  - we:scripts/lib/__tests__/jury-core.test.mjs
  - we:scripts/review-core-cli.mjs
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/__tests__/review-core.test.mjs
  - we:scripts/workflows/review-parked-prs.mjs
  - we:scripts/lane-resume.mjs
  - we:scripts/__tests__/lane-resume.test.mjs
  - we:scripts/lane-drain.mjs
  - we:scripts/__tests__/lane-drain.test.mjs
---

# CI-green land clause folded in + off-by-default convergence flag

Capstone: fold required-test-green into deriveNegotiationOutcome's land condition and retire the lane-resume test-red strand (we:scripts/lane-resume.mjs:81); wire the whole loop behind an off-by-default flag (we:scripts/lane-drain.mjs flag parsing), scoped to small/non-security diffs first. Blocked by A+B+C. Slice D of epic #2410.

## Progress

- **CI-green land clause folded in (`we:scripts/lib/jury-core.mjs`).** `deriveNegotiationOutcome` gained a
  `requiredTestGreen` clause: an `accept` verdict now lands ONLY when the required `test` is green; an accept over
  a red/pending check re-enters the round loop like a `changes` (continue under the cap, escalate at it), never a
  silent land. `requiredTestGreen` DEFAULTS to `true`, so every pre-#2410 caller stays byte-stable; it fails CLOSED
  on an explicit not-green (including `null`/unknown). The reducer stays subject-agnostic — the caller maps its CI
  state to the boolean.
- **Threaded through the loop's CLI seam (`we:scripts/review-core-cli.mjs`).** `reduceReview` forwards
  `requiredTestGreen` (JSON field or `--required-test-green` flag) into the `deriveNegotiationOutcome` step, so the
  live convergence loop folds CI-green into its `outcome`. The plan handshake (no diff yet) never carries it.
- **Loop wiring (`we:scripts/workflows/review-parked-prs.mjs`).** The reduce prompt now reads the PR's required
  `test` conclusion and includes `requiredTestGreen` in the payload, making the fold live end-to-end.
- **Retired the lane-resume test-red strand (`we:scripts/lane-resume.mjs`).** The required-`test` classification is
  single-sourced through the new `requiredCheckState` (see below): `landDecision` no longer keeps its own FAIL list,
  and `classifyLane`'s `testRed` is now the full `red` state (any definitive failing conclusion — FAILURE /
  CANCELLED / TIMED_OUT / …), not FAILURE-only.
- **Single-sourced classifier + off-by-default switch (`we:scripts/lane-drain.mjs`).** Added `requiredCheckState`
  (green / red / pending) + `isRequiredTestGreen` — the ONE required-check reader the drain family shares. Added the
  off-by-default convergence switch (`convergenceLoopEnabled` from `--converge` / `WE_CONVERGENCE_LOOP`, OFF by
  default) and `convergenceEligible` (scoped to small/non-security diffs — a `scoreEscalation` blast-radius /
  gate-self / statute / size signal scopes a diff out). The switch state rides the drain result.
- **Tests.** Extended jury-core (the CI-green clause + fail-closed), lane-drain (the classifier + the switch +
  eligibility), and lane-resume (the broadened red set). `npm run check:standards` green; 400 tests pass across the
  touched suites.
