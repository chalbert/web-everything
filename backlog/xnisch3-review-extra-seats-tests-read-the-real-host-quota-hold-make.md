---
kind: story
size: 1
status: resolved
scope: ["we:scripts/operations/__tests__/review-extra-seats.test.mjs", "we:scripts/operations/review-extra-seats.mjs"]
dateOpened: "2026-10-01"
dateResolved: "2026-10-01"
graduatedTo: f78705a502
tags: []
---

# review-extra-seats tests read the real host quota hold; make them hermetic

Live case 2026-10-01: the #3215 fixer finished its repair (saved on lane/slow-rounds2-fix-3215-alt, b12845fdb) but stood down because the lane gate was red only on we:scripts/operations/__tests__/review-extra-seats.test.mjs, which reads this host real Antigravity quota hold (the agy quota ran out that afternoon) instead of an injected one. A test whose result depends on live provider quota blocks unrelated PRs. Fix: inject the quota-hold reader and its store root in every case of that test file so no case reads host state; add a guard case that runs with a host hold present and still passes. Proof: the file passes on a host with an active agy quota hold.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
