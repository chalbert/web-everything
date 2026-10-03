---
bornAs: x2c7uas
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/probation-launcher.mjs", "we:scripts/operations/probation-build-run.mjs", "we:scripts/lib/__tests__/probation-launcher.test.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a contract test that feeds an alphanumeric id through parseProposedBlockedBy, validateProposedBlock… (from chalbert/web-everything#3783 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/probation-launcher.mjs:232` — Add a contract test that feeds an alphanumeric id through parseProposedBlockedBy, validateProposedBlockedBy and blockedByGraph. Better, share one backlog-id regex constant with check-standards so the two cannot diverge.
2. `we:scripts/operations/probation-build-run.mjs:571` — Add a runProbationBuild prepare-path test with a fake io whose card body carries a `## Proposed blockedBy changes` section. Assert an abandon on a cyclic proposal and the proposal text in the writePrBody args on a valid one.
3. `we:scripts/operations/probation-build-run.mjs:571` — A contract test that every new runner abandon/fail-closed branch has a named runner-level test, for example a check:standards rule requiring each `abandon(` reason string to appear in a test file.
4. `we:scripts/operations/probation-build-run.mjs:574` — Add a deterministic runProbationBuild integration test with a parsed invalid proposal and a supplied graph, asserting gate-red and no PR creation; ensure removing the validation branch makes that test fail.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3783@2341caec72073913fe88596e654f65bbe854ae36

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
