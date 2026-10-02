---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/health-pr-attempts.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/health-smells/index.mjs", "we:scripts/conveyor/health-smells/repeated-pr-attempts.mjs", "we:scripts/conveyor/__tests__/health-pr-attempts.test.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:scripts/conveyor/health-smells/__tests__/index.test.mjs", "we:scripts/conveyor/health-smells/__tests__/repeated-pr-attempts.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a unit test that feeds one successful multi-effect ci-heal run to recordPrAttempts and asserts it y… (from chalbert/web-everything#3270 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/health-pr-attempts.mjs:64` — Add a unit test that feeds one successful multi-effect ci-heal run to recordPrAttempts and asserts it yields at most one attempt. Alternatively, count one attempt per run id and PR instead of per effect.
2. `we:scripts/conveyor/health-watch.mjs:749` — Add a deterministic tick integration test with distinguishable fixture and host records, asserting that fixture flags exclude host evidence; verify that removing the fixtureTick conditional makes it fail.
3. `we:scripts/conveyor/health-smells/index.mjs` — A check:standards lint that verifies all .mjs files in health-smells/ are exported by we:scripts/conveyor/health-smells/index.mjs.
4. `we:scripts/conveyor/health-smells/repeated-pr-attempts.mjs` — A type check or schema validation on smell exports that ensures destructured keys in evaluate match the declared probes array.
5. `we:scripts/conveyor/health-watch.mjs` — An ESLint no-undef rule running in the CI pipeline.
6. `we:scripts/conveyor/health-watch.mjs` — A review checklist requiring every behavioral claim in prose to have a corresponding test assertion.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3270@e0b6162699affe6a3f3d646989957aa4798030ac

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
