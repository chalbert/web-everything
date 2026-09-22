---
bornAs: x8r842h
kind: story
size: 2
parent: "3383"
status: open
dateOpened: "2026-09-22"
tags: []
---

# verify-lane default gate runs WE-only npm scripts in plateau-app and frontierui lanes, so every non-WE lane verifies red

The default gate in we:scripts/lib/verify-lane-gate.mjs hard-codes the WE scripts test:unit and check:standards. plateau-app has neither (its suite is vitest run via npm test), so a verify on a plateau-app lane always fails with Missing script, and pr-land then refuses to land until someone passes a hand-written gate (hit on plateau-app PR 168, 2026-09-22). The gate should pick the commands the checkout actually has.

## Done when

1. **Executable** — a unit test on `we:scripts/lib/verify-lane-gate.mjs`: given a checkout whose npm scripts have `test` but no `test:unit` / `check:standards`, the default gate runs `npm test` and skips the missing health gate; a WE checkout still gets today's gate unchanged.
2. **Observed** — `node we:scripts/operations/run.mjs verify --checkout=<a plateau-app lane>` goes green on a clean lane with no `--gate` override.
