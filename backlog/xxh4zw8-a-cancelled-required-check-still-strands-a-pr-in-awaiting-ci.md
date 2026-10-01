---
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# A cancelled required check still strands a PR in awaiting-ci after #4187 was resolved

Live case 2026-10-01: PR #3336 has sat review-status:awaiting-ci since 3:04 PM ET (3.5+ hours) because its required smoke check is CANCELLED while every other required check passed; no CI heal or re-run was dispatched. Card #4187 (ci-heal never dispatches for a CANCELLED required check) is resolved, so either its fix does not reach this path (the PR also carries one review-gate FAILURE beside a later review-gate SUCCESS) or it regressed. Find which reader still misses it (we:scripts/conveyor/reconcile-core.mjs classifyPr, the awaiting-ci status tagger), fix it, and replay #3336: a cancelled required check gets a re-run or a ci-heal within one tick.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
