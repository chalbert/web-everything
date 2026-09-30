---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3036's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/probation-build-run.mjs:378` — Add a unit test that feeds an oversized already-done message and asserts the stored hold reason length is bounded. Longer term, have `holdWorkerDecline` itself apply `sanitizeHoldReason`, so every caller gets the bound.
2. `we:scripts/operations/probation-build-run.mjs:378` — Add a unit test asserting that every `holdWorkerDecline` entry's reason is at most 600 characters and has no control characters, for both the decline and already-done routes. Better, move sanitizing into `holdWorkerDecline` itself so no route can skip it.
3. `we:scripts/operations/probation-build-run.mjs:370` — Add the moved-HEAD case to the `runProbationBuild` arc tests. A checklist item in the review lens that every new refusal branch needs a named test would catch this class.
4. `we:scripts/operations/probation-build-run.mjs:367` — TypeScript strict null checks or a runtime string assertion at the boundary of `planHoldRouting`.
5. `we:scripts/operations/probation-build-run.mjs:372` — Enforcing maximum byte length directly in `placeBuildDispatchHold` for all holds.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3036@cf5ddca6098fd6b80c6d5a7b0b98994ed890ac64

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
