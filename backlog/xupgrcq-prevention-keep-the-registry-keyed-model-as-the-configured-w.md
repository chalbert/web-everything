---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/probation-launcher.mjs", "we:scripts/lib/__tests__/antigravity-run-evidence.test.mjs", "we:scripts/lib/antigravity-run-evidence.mjs", "we:scripts/operations/review-extra-seats.mjs", "we:scripts/operations/probation-build-run.mjs", "we:scripts/lib/__tests__/probation-launcher.test.mjs", "we:scripts/operations/__tests__/review-extra-seats.test.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — Keep the registry-keyed model as the configured worker model and add provenance only in the separate se… (from chalbert/web-everything#3227 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/probation-launcher.mjs:407` — Keep the registry-keyed `model` as the configured worker model and add provenance only in the separate servedModel/requestedModel fields. Add a launchScorecardRow test with empty evidence that asserts the model stays equal to worker.model, and a model-probation test that grouping is unchanged for an unparsed run.
2. `we:scripts/lib/__tests__/antigravity-run-evidence.test.mjs:1` — Add boundary tests for each place evidence is plumbed (realIo runWorker, createDefaultJudge catch, driveRun catch). Consider a lint or standards rule that new exported helpers need a call-site test.
3. `we:scripts/lib/antigravity-run-evidence.mjs:18` — Tighten the regex to anchored RESOURCE_EXHAUSTED / 'Individual quota reached' forms. Clamp the delay to a maximum (e.g. 7d) and guard against an invalid Date. Make `readAgyHold` skip unparseable files. Add unit tests for each of these inputs; a property test on `agyRunEvidence` with arbitrary stderr would catch the throw.
4. `we:scripts/lib/antigravity-run-evidence.mjs:40` — Run `pickAgyEvidence` on the parsed hold row inside `readAgyHold`. Add a test that a hold file with extra keys does not leak them into the result.
5. `we:scripts/operations/review-extra-seats.mjs:443` — Add tests for the `classifySeatCall` mismatch branch and the resume suppression. Optionally add a strict mode that treats a missing init event as skip-unverified for merge-gating seats.
6. `we:scripts/lib/antigravity-run-evidence.mjs:21` — Add deterministic table-driven tests for recognized request aliases, asserting that sonnet-to-opus and opus-to-sonnet substitutions are refused while matching model families remain accepted.
7. `we:scripts/operations/probation-build-run.mjs` — Add an integration test in `we:probation-build-run.test.mjs` that mocks `trySh` to return formatted text, verifying that the actual scorecard row contains the correctly fallback requested model.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3227@b0b5ce6ed97312e7254723dbf494aa3e3d6f2d8e

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
