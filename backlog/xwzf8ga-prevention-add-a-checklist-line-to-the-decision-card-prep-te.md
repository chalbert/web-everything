---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/3993-decision-permission-profiles-for-all-agent-work-scoped-by-de.md"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — Add a checklist line to the decision-card prep template for any proposal that persists agent state: sta… (from chalbert/web-everything#3241 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/3993-decision-permission-profiles-for-all-agent-work-scoped-by-de.md:109` — Add a checklist line to the decision-card prep template for any proposal that persists agent state: state its redaction, access-control, integrity and untrusted-input handling. Also add a follow-up acceptance canary that plants a secret in the context and checks it is scrubbed from the retained handoff.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3241@04112b4ed16c3b85b8150bc1f4b2c7f8e2ffbd49

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
