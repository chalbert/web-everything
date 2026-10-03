---
bornAs: xg976ie
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/ci-auth-diagnosis.mjs", "we:scripts/conveyor/__tests__/ci-auth-diagnosis.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a check:standards rule that fails when a non-test script under scripts/ imports a bare package that… (from chalbert/web-everything#3296 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/ci-auth-diagnosis.mjs:2` — Add a check:standards rule that fails when a non-test script under scripts/ imports a bare package that is not listed in we:package.json dependencies. Alternatively, load YAML lazily inside the try block so a missing parser degrades to 'unavailable'.
2. `we:scripts/conveyor/ci-auth-diagnosis.mjs:14` — Capture a real run payload (pull_request event) as a golden fixture and assert that the collector reads it, instead of hand-built JSON.
3. `we:scripts/conveyor/ci-auth-diagnosis.mjs:9` — Add one shared 'untrusted text to PR comment' sanitiser (zero-width-space after @ and #, defang URL schemes) with a lint or check:standards rule that flags interpolating workflow, log or API-derived strings into comment bodies without it.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3296@a409a38896729f310fd6c104e29018d6c7fea6e3

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
