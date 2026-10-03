---
bornAs: xenrh2h
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4774-a-red-verify-names-the-failing-tests-in-its-run-record-and-m.md"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a Must to the card: summaries and names are sanitized (control characters stripped, a fixed length… (from chalbert/web-everything#3400 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4774-a-red-verify-names-the-failing-tests-in-its-run-record-and-m.md:30` — Add a Must to the card: summaries and names are sanitized (control characters stripped, a fixed length cap) and the summary is a fixed-form or allowlisted excerpt, never raw log text. Add a collector test with secret-like and injection-like input. Longer term, add a `check:standards` rule that cards persisting captured process output must state a redaction or untrusted-text policy.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3400@d3c0c3b230687098b086afd312f7fe7bb2a3eafc

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
