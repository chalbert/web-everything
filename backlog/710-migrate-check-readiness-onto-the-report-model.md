---
kind: story
size: 2
parent: "350"
status: resolved
blockedBy: ["435"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-16"
graduatedTo: scripts/readiness/engine.mjs
tags: []
---

# Migrate check:readiness onto the report model

Slice B of #435's reporter-migration fan-out: extend we:check-readiness.mjs --json/--select to emit a Report (ranked selection + batch pack as a section with scores[]), reusing buildReport() from #435. Terminal path stays bespoke.

## Progress (2026-06-15, batch-2026-06-15)

- **Authored `buildReadinessReport(selection, batchPack, budget)`** in the pure readiness engine
  ([we:scripts/readiness/engine.mjs](../scripts/readiness/engine.mjs)) — re-expresses the ranked selection +
  the budget-filled batch pack as a #431 report-model `Report` via the shared #435 `buildReport()`. Two
  **scores-only** sections (readiness is a ranking, not a conformance pass, so **no findings**):
  `ranked-selection` (every Tier-A item, `value` = leverageScore, `unit: leverage`) and `batch-pack` (the
  picked items, `value` = batchCost, `max` = the points budget, `unit: pts`; the label tags each item's
  locus). Lives in the engine, not the CLI, because the CLI has top-level `process.exit` — an exported
  symbol there would fire the whole script on import; the engine is pure (no fs/process), so it's testable.
- **Wired it into `--json`** ([we:scripts/check-readiness.mjs](../scripts/check-readiness.mjs)) under a new
  `report` key, alongside the legacy `selection`/`batch` keys the skill already consumes (additive, no
  break). The **terminal/ANSI + `--select` human paths stay bespoke** per scope — only the structured
  `--json` view migrates.
- **Tests** ([we:scripts/readiness/__tests__/engine.test.mjs](../scripts/readiness/__tests__/engine.test.mjs)):
  source/sections shape, both `scores[]` mappings, and model-validity proven by piping through the #434
  `toSarif`/`toJUnit` export adapters (the cross-cutting proof for a scores-only report; the findings-table
  renderer isn't the applicable view). 28/28 green. `check:standards` 0 errors.
