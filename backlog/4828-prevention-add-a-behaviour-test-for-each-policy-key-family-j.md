---
bornAs: xhtyn7m
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/cli-adapter.mjs", "we:scripts/operations/review-extra-seats.mjs", "we:scripts/lib/dispatch-routing-policy-source.mjs", "we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/cli-adapter.test.mjs", "we:scripts/operations/__tests__/review-extra-seats.test.mjs", "we:scripts/lib/__tests__/dispatch-routing-policy-source.test.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs", "we:scripts/operations/__tests__/run.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — Add a behaviour test for each policy-key family (judge:*, review-seat:*, review-recheck) that resolves… (from chalbert/web-everything#3209 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/cli-adapter.mjs:800` — Add a behaviour test for each policy-key family (`judge:*`, `review-seat:*`, `review-recheck`) that resolves through the real production entry point, not a hand-built call. Treat the policy header's promised keys as a checklist for those tests.
2. `we:scripts/operations/review-extra-seats.mjs:601` — Add a test in we:review-extra-seats.test.mjs where the cap permits fewer calls than distinct models. It should assert that granted calls are used, or released, rather than dropped.
3. `we:scripts/lib/dispatch-routing-policy-source.mjs:12` — Compare the full criticalWorkGate (kinds and every openForNonCritical row) in trustedSnapshot, and add a table-driven test that loosens each gate field in turn. Optionally pass a hash of the gate from parent to child. Captured as a deterministic test, not a doc note.
4. `we:scripts/operations/probation-build-run.mjs:208` — Add a standards rule or test asserting that every resolveOperationRoute call for a gated kind either passes a computed gateClosed or is dispatcher-supplied. Simplest fix: have standalone runners apply a policy route only when a --worker handed over by the dispatcher is present, and otherwise do nothing.
5. `we:scripts/operations/run.mjs:481` — Add a deterministic integration test through createCliJudgeFactory and createDefaultJudge that verifies a nondefault policy route without CLI pins, then verifies explicit provider/model pins override it.
6. `we:scripts/operations/cli-adapter.mjs` — A unit test asserting that a judge launched without explicit flags respects the policy configuration in `we:dispatch-routing-policy.json`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3209@184dca91d077f4089aa8e2b842232e69c15f5d75

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
