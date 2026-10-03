---
bornAs: xw26745
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/operations/probation-heal-run.mjs", "we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs", "we:scripts/operations/__tests__/probation-heal-run.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a routing test matrix that drives routeAvailableCiHeal through every refusal cause of decideDispatc… (from chalbert/web-everything#3577 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/ci-heal-pr-dispatch.mjs:182` — Add a routing test matrix that drives `routeAvailableCiHeal` through every refusal cause of `decideDispatchRouteLegacy` (empty scope, invalid profile, no candidate model, size policy) and asserts held versus native for each.
2. `we:scripts/operations/probation-heal-run.mjs` — Add a deterministic observer/provider regression test proving that exceeding the age ceiling cannot release ownership or permit another launch while the original wrapper remains alive; require confirmed termination before settlement releases the claim.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3577@e23f1963f2a7bef4d772ad99fd4ced26a33c3c43

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
