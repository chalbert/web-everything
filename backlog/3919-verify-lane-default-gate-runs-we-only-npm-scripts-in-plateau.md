---
bornAs: x8r842h
kind: story
size: 2
parent: "3383"
status: resolved
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
tags: []
---

# verify-lane default gate runs WE-only npm scripts in plateau-app and frontierui lanes, so every non-WE lane verifies red

The default gate in we:scripts/lib/verify-lane-gate.mjs hard-codes the WE scripts test:unit and check:standards. plateau-app has neither (its suite is vitest run via npm test), so a verify on a plateau-app lane always fails with Missing script, and pr-land then refuses to land until someone passes a hand-written gate (hit on plateau-app PR 168, 2026-09-22). The gate should pick the commands the checkout actually has.

## Done when

1. **Executable** — a unit test on `we:scripts/lib/verify-lane-gate.mjs`: given a checkout whose npm scripts have `test` but no `test:unit` / `check:standards`, the default gate runs `npm test` and skips the missing health gate; a WE checkout still gets today's gate unchanged.
2. **Observed** — `node we:scripts/operations/run.mjs verify --checkout=<a plateau-app lane>` goes green on a clean lane with no `--gate` override.

## Resolution

`we:scripts/verify-lane.mjs` now reads the target checkout's npm script names and passes them to the pure `resolveDefaultGate` (new `composeGate` helper in `we:scripts/lib/verify-lane-gate.mjs`): no `test:unit` ⇒ `npm test` (or an explicit skip if there is no test script), and the `check:standards` half only when that script exists. WE and frontierui (both have `test:unit` + `check:standards`) get the byte-for-byte unchanged command.

1. **Executable** — `we:scripts/lib/__tests__/verify-lane-gate.test.mjs` (#3919 block): WE/frontierui script sets ⇒ command identical to the legacy no-scripts call; plateau-app script set ⇒ `npm test`, no check:standards.
2. **Observed** — throwaway shallow clone of plateau-app (with frontierui + WE siblings, the real layout): `node we:scripts/operations/run.mjs verify --checkout=<clone>` with no `--gate` ⇒ `green (suites: npm test)`, 158 files / 2221 tests passed. The same clone under main's unchanged verify-lane ⇒ `Missing script: "test:unit"`, red.
