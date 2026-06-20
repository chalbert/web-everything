---
kind: story
size: 5
parent: "1026"
status: resolved
blockedBy: ["1070"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:process/provider.ts"
tags: []
---

# webprocess provider — artefact contract runtime in FUI

Slice B of webprocess impl epic #1026 (blockedBy slice A contract). Implement the self-driven artefact contract runtime in FUI (read + drive the artefact structure), conforming to the WE contract.

## Progress

Shipped the runtime-impl half alongside the type-only `we:process/contract.ts` (#1070), mirroring the
landed `we:reliability/` + `we:intl/` provider precedent (#1052/#1055):

- `we:process/registry.ts` — the two NEW + OWNED OPEN meta-schema registries: `AutonomyLevelRegistry`
  (`autonomyLevels`, seeded with the `L0–L5` default ladder, ordered `rank`/`min`/`insertAfter`) and
  `ToleranceDimensionRegistry` (`toleranceDimensions`, seeded with the default dimension set). Open
  vocabularies a recipe `define()`s onto (the Web Intents lesson).
- `we:process/provider.ts` — contract re-export (file-seam split) + the trust-boundary guards every
  foreign-tool-written artefact crosses: `assertArtefactRef` / `assertGateDefinition` / `assertStep` /
  `assertProcessRecipe` / `assertToleranceProfile`, with `ArtefactContractError` and the closed
  kind/severity/tolerance sets.
- `we:process/driver.ts` — the driving loop that reads + drives the artefact structure: `runnableSteps`
  (the webworkflows dependency frontier), `isRunComplete`, `indexSteps` (broken-edge guard), and
  `effectiveCeiling` — the nominal autonomy ceiling throttled DOWN by the recipe's tolerance dial (the
  ODD rule), with the shipped `defaultToleranceThrottle` (one rung per `low` dimension, floored at L0).
- `we:process/index.ts` — `createDefaultSeam()` + the one fully-defined `webprocess/default` recipe
  (config-extends-platform-default; most-permissive base, the project recipe opts into restriction).
- `we:process/__tests__/runtime.test.ts` (33 tests) + the `we:vitest.config.ts` glob.

The Plateau recipe configurator stays impl (→ plateau-app), per the ratified layering.
