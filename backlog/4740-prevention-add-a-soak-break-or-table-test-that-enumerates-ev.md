---
bornAs: x77fr13
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/missing-run-push.mjs", "we:scripts/conveyor/__tests__/missing-run-push.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a soak break or table test that enumerates every defer(...) return in pushMissingRunCommit and asse… (from chalbert/web-everything#3253 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/missing-run-push.mjs:29` — Add a soak break or table test that enumerates every `defer(...)` return in pushMissingRunCommit and asserts each is reachable only from transient state, or makes the sweep cap a deferral count per sha. Filter by `lane/` in buildMissingRunCandidates so the candidate set matches the actuator's preconditions.
2. `we:scripts/conveyor/missing-run-push.mjs:31` — A unit test that ensures structurally invalid properties (like non-lane branches) yield a terminal counted failure rather than a free deferral.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3253@95cb216548ba6b8e702c49527745ccd50355a7d6

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
