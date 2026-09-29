---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3009's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/probation-build-run.mjs:165` — Derive the allowlist from AGY_CLAUDE_MODEL_BY_TIER values plus AGY_GEMINI_SIMPLE_MODEL, and add a test that every model selectProbationWorker can emit passes parseArgs.
2. `we:scripts/operations/probation-build-run.mjs:343` — Call the shared critical-work path classifier (the same source as DISPATCH_MACHINERY_PATHS and criticalWork) from the build-run arc for non-doc taskTypes, and add a test that a machinery-path scope is refused. A check:standards rule requiring every probation launcher to call it would be the deterministic gate.
3. `we:scripts/operations/probation-build-run.mjs:616` — Add a deterministic integration test exercising the production scorecard adapter with a held lock and legacy migration input, asserting refusal without modifying either store.
4. `we:scripts/operations/probation-build-run.mjs` — A static linting rule (`no-undef` / `no-use-before-define`) enforced by the `check:standards` script.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3009@0e0a0986875cca3f8b1ebed4e2db344d3808d234

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
