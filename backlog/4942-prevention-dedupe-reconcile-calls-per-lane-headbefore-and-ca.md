---
bornAs: xvjzkmq
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/health-watch.mjs", "we:scripts/lib/lane-history.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:scripts/lib/__tests__/lane-history.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Dedupe reconcile calls per (lane, headBefore) and cap the count per probe run. Add a test asserting tha… (from chalbert/web-everything#3286 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/health-watch.mjs:415` — Dedupe reconcile calls per (lane, headBefore) and cap the count per probe run. Add a test asserting that N identical entries trigger one git call. A lint or standards rule that flags execFileSync inside a map in probe* functions would be the deterministic gate.
2. `we:scripts/lib/lane-history.mjs:205` — Have reconcile return a separate verdict (for example `{entry, reachableNow}`) or strip the field when reading the journal. Add a test that a journal line carrying `remoteReachableNow:true` still fires.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3286@ed1c9ae1e2baafdaabcbefeb4709a7e8b7e8cacb

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
