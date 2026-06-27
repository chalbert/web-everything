---
kind: story
size: 3
parent: "1294"
status: resolved
blockedBy: ["1808"]
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "fui:webcompliance/"
tags: []
---

# Relocate the webcompliance runtime (gate/waiver/audit) to FUI

C2 of the webcompliance relocation cascade (#1294). Move the runtime — runGate + resolvePolicy from we:webcompliance/gate.ts, applyWaivers from we:webcompliance/waiver.ts, auditToReport from we:webcompliance/audit.ts — out of WE per #1282 to fui:webcompliance/, importing the policy model via @webeverything/contracts/webcompliance; register the alias in FUI vitest/vite/tsconfig (mirrors #1799). Keep we:webcompliance/contract.ts as the WE contract. All deps injected so the move is clean; the audit→Report type seam resolves from the renderer's home.

## Progress

- **Status:** resolved
- **Done:** created `fui:webcompliance/gate.ts` + `fui:webcompliance/waiver.ts` + `fui:webcompliance/audit.ts` (production impl) + `fui:webcompliance/index.ts` barrel + copied 3 runtime tests to `fui:webcompliance/__tests__/`. The runtime imports the contract via `@webeverything/contracts/webcompliance`; the FUI `fui:webcompliance/audit.ts` imports the #431 Report-model types via a new `@webeverything/contracts/report` alias (type-only → the WE renderer's home). Registered both aliases + the test-include glob in `fui:vitest.config.ts`, `fui:vite.config.mts`, `fui:tsconfig.json`.
- **Verified:** FUI webcompliance 18/18 tests pass · FUI tsc clean for webcompliance. FUI `check:standards` has 34 pre-existing errors (hard-coded tags in `upgrader`/`resource-loader` fixtures, #841/#844) — **none in webcompliance**, outside this changeset, so not this work's stop.
- **Next:** WE runtime stays until C5 (#1815); C3 (#1809) builds the conformance binding + vectors.
- **Notes:** scope discovery — webcompliance also ships `we:webcompliance/conventions/vcs.ts` (independent VCS-conventions runtime, no imports) + `we:webcompliance/policies/platform-default.ts` (policy data). vcs is captured as its own slice **#1819** (parallel, outside the gate cascade); policies stays WE as reference data (its `CompliancePolicy` type-import gets repointed from the runtime module to the contract module at C5).
