---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/lib/dispatch-contracts.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs", "we:scripts/lib/__tests__/dispatch-contracts.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3038's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/probation-build-run.mjs:373` — Add a runProbationBuild test for prepare with an empty diff and a worker final message. Assert the outcome is a decline, not a scored gate-red, and that the message is preserved.
2. `we:scripts/lib/dispatch-contracts.mjs:1147` — Add a decideDispatchRoute test for a critical prepare-item asserting the intended outcome. Alternatively, a lint that flags an entry in a gate's `kinds` list with no reader on the route the kind takes.
3. `we:scripts/lib/dispatch-contracts.mjs:1147` — Add a routing test that a prepare-item dispatch with a statute-tier or critical scope gets no probationWorker. Better, pass the card's scope paths to the critical-work verdict. If the operator intends prepare to ignore criticality, record that as an explicit documented decision.
4. `we:scripts/operations/__tests__/probation-build-run.test.mjs:757` — Add a test-plan checklist item, or a coverage-of-refusals lint, requiring one test per new abandon or throw branch. Then add cases: status:active card, a prepare worker of antigravity-claude, and a stamp that touches an extra path.
5. `we:scripts/operations/probation-build-run.mjs:319` — Add a deterministic integration test that carries an implementation-scoped prepare dispatch through launch argument construction and runner envelope validation, asserting that a target-card edit succeeds with an appropriate card lease.
6. `we:scripts/operations/probation-build-run.mjs` — A generalized parameterized unit test in `we:scripts/operations/__tests__/probation-build-run.test.mjs` that enforces the decline path (0 files changed) is successfully processed as a decline rather than a crash/red-gate across all supported task types.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3038@566638ce874d45aa7504abbb449871e689b3c59e

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
