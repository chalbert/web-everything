---
bornAs: xhkgh0i
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a CLI-level fixture test (the repo already has the temp-clone harness added in this PR) that runs c… (from chalbert/web-everything#3718 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/check-standards.mjs:774` — Add a CLI-level fixture test (the repo already has the temp-clone harness added in this PR) that runs check-standards with the PR-CI env vars set and asserts the strand is downgraded to a warning.
2. `we:scripts/check-standards.mjs:996` — Report the missing base as a single err() with a descriptor (so --json stays valid and other findings still print) rather than throwing. Also add a standards or test rule that fixtures spawning we:scripts/check-standards.mjs must pin refs/remotes/origin/main.
3. `we:scripts/check-standards.mjs:774` — Add a CLI-level case to the existing scope-guard fixture test: seed a stranded hash on the fixture's origin/main, run with the PR env vars, and assert warning-not-error. A lint rule requiring every exported env predicate to have a call-site test would cover the whole class.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3718@e30704b95d655b1589f105d43864fa571c54592d

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
