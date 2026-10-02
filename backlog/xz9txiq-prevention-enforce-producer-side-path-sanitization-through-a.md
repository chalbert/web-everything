---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:contracts/plateau-progress-view.schema.json"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Enforce producer-side path sanitization through a dedicated linter or validation test, rather than rely… (from chalbert/web-everything#3528 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:contracts/plateau-progress-view.schema.json:3266` — Enforce producer-side path sanitization through a dedicated linter or validation test, rather than relying on structural schema documentation to enforce behavior.
2. `we:contracts/plateau-progress-view.schema.json:3125` — Implement consumer-side architectural tests that explicitly assert executor inference does not occur, instead of placing this burden on schema documentation.
3. `we:contracts/plateau-progress-view.schema.json:3280` — Add producer-side integration tests that verify overlap evidence corresponds to actual system state.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3528@2eae87883862da75b39c08c9be10e763afc76606

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
