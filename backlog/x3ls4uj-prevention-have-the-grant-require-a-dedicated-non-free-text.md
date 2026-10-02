---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:skills-src/conveyor/__tests__/reconcile-fix-dispatch-daemon.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Have the grant require a dedicated, non-free-text marker, such as a distinct human-only ceremony or a b… (from chalbert/web-everything#3431 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/reconcile-core.mjs:1245` — Have the grant require a dedicated, non-free-text marker, such as a distinct human-only ceremony or a build*Marker-rendered block, and add a test that an operator-credential comment with --actor set to the operator's login does not grant. A lint or standards rule could flag any new trust decision based on `Recorded by` prose.
2. `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs:310` — Add a shared env-boolean parser, enforced by a check:standards rule, that treats 0, false, off and no as disabled. Pin it with a test over those values.
3. `we:scripts/conveyor/reconcile-core.mjs:1260` — Add a deterministic parameterized regression test covering send-back renewal when each supported attempt source independently dominates, including counts with missing or lagging comment markers.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3431@0c0b23950e9dc787761645ee1f058579f3328590

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
