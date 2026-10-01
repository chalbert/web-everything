---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:src/backlog-view/proof-tiers.ts", "we:src/backlog-view/__tests__/proof-tiers.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — A deterministic unit test verifying that fully-qualified cross-origin HTTPS links (e.g., https://ci.example… (from chalbert/plateau-app#192 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:src/backlog-view/proof-tiers.ts:71` — A deterministic unit test verifying that fully-qualified cross-origin HTTPS links (e.g., `https://ci.example/...`) are preserved and rendered correctly when the provided `baseUrl` belongs to a different origin.

Idempotency key (do not edit): approval-prevention-key:chalbert/plateau-app#192@decd6891d8fe7228e16e8eb52666e70ef9e9c1fb

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
