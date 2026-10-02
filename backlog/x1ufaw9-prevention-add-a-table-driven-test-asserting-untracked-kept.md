---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/daemon-rebuild.mjs", "we:scripts/lib/__tests__/daemon-rebuild.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a table-driven test asserting untracked-kept is emitted for every terminal reason reached after ens… (from chalbert/web-everything#3295 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/daemon-rebuild.mjs:1365` — Add a table-driven test asserting `untracked-kept` is emitted for every terminal reason reached after `ensureSafeToMove`. The review lens would be to check that every early return keeps its previous alert contract when a side effect moves.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3295@5ecd130b7ebb991c79ceb9ffe8503327277106e9

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
