---
kind: story
size: 5
parent: "1167"
locus: frontierui
status: resolved
blockedBy: ["1168", "1169"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:tools/explorer/gate.ts"
tags: []
---

# Gate mode + agent-invoked pre-close gate on UI work items

Consumer 3 of the autonomous UI tester (epic #1167, locus frontierui). Add the deterministic GATE profile to the engine (#1168) + Layer-1 oracle bus (#1169): fixed seed, hard step/time budget, fails only on hard Layer-1 invariant violations, records seed+step trace on failure for replay (the explore-vs-gate split per fast-check/Meticulous). Then wire it as an agent-invoked pre-close gate on UI work items — finishing a UI story runs the gate on the affected page/component, which must pass before status:resolved, alongside check:standards and the #770 a11y gate.

## Resolved (batch-2026-06-19) — deterministic GATE profile + pure verdict + replay trace

The deterministic counterpart to the EXPLORE consumers (#1170/#1171):

- **`fui:tools/explorer/gate.ts`** — the PURE gate logic: `GATE_PROFILE` (fixed, bounded `maxStates 20`/`maxDepth 8` — terminates deterministically), `gateVerdict(graph, findings, seedUrl)` → `{ passed, hardFindings, statesExplored, trace? }`. Fails ONLY on hard (`error`-severity) Layer-1 findings (crash/console-error/5xx/unhandled-rejection); warn-level (a11y/layout/focus) never blocks. On failure it records the **replay trace** — the seed + the BFS candidate-id path to the first failing state (`pathToState`) — so a red gate is reproducible, not flaky.
- **`fui:tools/explorer/gateRunner.ts`** — the thin live `runGate(page, seedUrl, opts)` wrapper. Split from the pure module on purpose: importing `fui:tools/explorer/gate.ts` must NOT transitively load `@axe-core/playwright` (it crashes outside a real browser — caught when the unit test failed to collect; the split fixed it).

**Pre-close wiring:** the delivered entry point is `runGate` — an agent finishing a UI work item runs it on the affected page/component and refuses `status: resolved` when `verdict.passed` is false, alongside `check:standards` + the #770 a11y gate; `verdict.trace` replays the failure. (The mechanical hook into the closing-session skill is the integration follow-up — `runGate` is the gate it calls.)

Tests: `fui:tools/explorer/__tests__/gate.test.ts` (5 — pass on warn-only, fail+trace on a hard finding, empty trace when the seed itself fails, BFS path found/same-state/unreachable) + `fui:tools/explorer/__tests__/gate.smoke.spec.ts` (a BOUNDED live Playwright smoke against the real workbench on `:3001` — reused, not spun — asserting a well-formed, **DETERMINISTIC** verdict: same seed run twice → same pass/fail + states-explored; **passed in 18.7s**). Full explorer unit suite green (27); `tsc --noEmit` clean; FUI `check:standards` green.

This completes the three consumers of epic #1167 (#1170 component stress-test / #1171 docs-site sweep / #1172 gate) over the one engine (#1168) + oracle bus (#1169).
