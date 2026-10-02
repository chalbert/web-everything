---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:src/return-to.ts", "we:src/__tests__/return-to.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — A property-based test that feeds valid, non-malicious paths (including unicode and mixed-case encodings) to… (from chalbert/plateau-app#191 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:src/return-to.ts:24` — A property-based test that feeds valid, non-malicious paths (including unicode and mixed-case encodings) to ensure the normalization logic does not unexpectedly drop legitimate destinations.

Idempotency key (do not edit): approval-prevention-key:chalbert/plateau-app#191@40b136c914961b8f23c37d84deb9cb36527271f1

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
