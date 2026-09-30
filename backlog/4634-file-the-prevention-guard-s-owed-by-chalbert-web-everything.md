---
bornAs: xz6ppko
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs", "we:scripts/operations/probation-build-run.mjs", "we:scripts/conveyor/prepare-failure-policy.mjs", "we:docs/agent/testing.md", "we:scripts/operations/__tests__/probation-build-run.test.mjs", "we:scripts/conveyor/__tests__/prepare-failure-policy.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3090's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/build-dispatch-daemon.mjs:252` — Add a daemon test per release path: settled-row only, ledger-only, and ledger plus settled row. Lint that each branch in the `released` computation is hit by a test.
2. `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:1598` — When the fixture that a guard test relies on is removed, require a replacement test for the new behaviour, such as a stale wrapper-failed row producing a hold and a card. Flag deleted fixture rows in review.
3. `we:scripts/operations/probation-build-run.mjs:223` — Known-cause labels should require a matching diagnostic, for example the stamp-diagnostic code for result-lost. Otherwise treat the failure as unknown. Add a classifier table test where structurally identical failures with different diagnostics map to different causes.
4. `we:skills-src/conveyor/build-dispatch-daemon.mjs:73` — Exclude attempts whose recorded cause is `infra-transient` from the route latch. Add a test that two transient failures leave the route on probation.
5. `we:scripts/conveyor/prepare-failure-policy.mjs:76` — Fingerprint only stage plus a closed-enum cause (or a fixed normaliser that drops free text). Add a test that two different terminal texts for the same stage produce one filed card.
6. `we:scripts/conveyor/prepare-failure-policy.mjs:52` — On a corrupt ledger, hold all candidates (fail closed) or refuse to tick until an operator clears it. Add a test asserting a corrupt ledger does not release or re-open a previously held item.
7. `we:skills-src/conveyor/build-dispatch-daemon.mjs:1067` — Record a ledger attempt (cause unknown, held) when a `starting` marker has no terminal record at reclaim time. Correct the doc line and add a test for a crashed worker.
8. `we:docs/agent/testing.md:671` — A review lens that requires every absolute mechanical claim ("do not expire", "never") in documentation to be matched by a corresponding test assertion (e.g., `expect(lease).toBe(Infinity)`).
9. `we:skills-src/conveyor/build-dispatch-daemon.mjs:427` — A strict 100% line coverage requirement on `runBuildDispatchTick` enforced by Vitest in CI, ensuring every new data branch has a corresponding test.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3090@d7a44d0a3d773d3b897a8edc58712863b8e4f7c5

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
