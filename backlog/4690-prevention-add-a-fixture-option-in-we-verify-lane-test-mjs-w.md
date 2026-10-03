---
bornAs: x0b4jvh
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/verify-lane.mjs", "we:scripts/__tests__/verify-lane.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a fixture option in we:verify-lane.test.mjs where the fake npx edits the failing file during the fi… (from chalbert/web-everything#3649 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/verify-lane.mjs:437` — Add a fixture option in `we:verify-lane.test.mjs` where the fake `npx` edits the failing file during the first vitest call. Assert the result stays red with no retry.
2. `we:scripts/verify-lane.mjs:441` — Add an integration case in we:verify-lane.test.mjs where the fake vitest mutates a failing test file mid-run, plus one where git fails after the first run. Both should assert the gate stays red with no retry.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3649@31af92e7910ae21df8b75014b8694c3e21e59948

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
