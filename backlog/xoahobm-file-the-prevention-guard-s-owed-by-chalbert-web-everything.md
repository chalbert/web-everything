---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/conveyor/build-dispatch-hold-router.mjs", "we:scripts/operations/build-dispatch-hold-route-land.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs", "we:scripts/conveyor/__tests__/build-dispatch-hold-router.test.mjs", "we:scripts/operations/__tests__/build-dispatch-hold-route-land.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3059's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/probation-build-run.mjs:434` — Add a test that runs every taskType in the runner's accepted list (prepare included) through the envelope-overflow case, and have the branch guard on `!preparing`.
2. `we:scripts/conveyor/build-dispatch-hold-router.mjs:59` — Carry a typed flag such as route.kind='envelope-overflow' from runProbationBuild through planHoldRouting to clearScopeAndAppendFinding, so the classifier and card writer never parse worker-influenced text. Add a regression test feeding a forged worker decline. The cheapest deterministic guard is a unit test in the hold-router suite.
3. `we:scripts/operations/build-dispatch-hold-route-land.mjs:141` — Route the publication text through the shared scrubPublish detector (we:secret-scrub.mjs), which the standards gate already uses, instead of a bespoke regex. Add space-containing and '~/' cases to the sanitizeHoldReason test.
4. `we:scripts/operations/build-dispatch-hold-route-land.mjs:139` — A unit test explicitly verifying that `sanitizeHoldReason` does not mangle valid code snippets like `1 / 2`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3059@eec46287c3ba36a0606edc433ed29ac3beb2764b

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
