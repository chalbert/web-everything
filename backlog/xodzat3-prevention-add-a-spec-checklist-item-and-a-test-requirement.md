---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4545-bad-credentials-smell-names-the-failing-secret-and-repo.md"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a spec checklist item and a test requirement that any value interpolated into an operator-facing co… (from chalbert/web-everything#3276 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4545-bad-credentials-smell-names-the-failing-secret-and-repo.md:35` — Add a spec checklist item and a test requirement that any value interpolated into an operator-facing command is allowlist-validated. A shared `renderOperatorCommand` helper that refuses non-matching tokens would enforce it deterministically.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3276@75925e5b83a1cb18f21174b5211c800f09985c08

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
