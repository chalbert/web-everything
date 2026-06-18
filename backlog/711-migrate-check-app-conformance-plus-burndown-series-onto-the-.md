---
type: idea
workItem: story
size: 3
parent: "350"
status: resolved
blockedBy: ["435"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: scripts/lib/conformanceReport.mjs
tags: []
---

# Migrate check:app-conformance plus burndown series onto the report model

Slice C of #435's reporter-migration fan-out: extend we:check-app-conformance.mjs --json to emit a Report — a coverage-matrix section (scores[] from layer1_conformance) plus a series[] sourced from the --burndown log (we:reports/app-conformance-burndown.json), reusing buildReport() from #435. The burndown series is part of this reporter, not a standalone one. Terminal path stays bespoke.

## Progress (2026-06-15, batch-2026-06-15)

- **Authored `buildConformanceReport(appRel, conformance, burndown)`** in the new pure module
  [we:scripts/lib/conformanceReport.mjs](../scripts/lib/conformanceReport.mjs) — maps check:app-conformance
  output onto a #431 `Report` via the shared #435 `buildReport()`. Two sections:
  - **`coverage`** — a coverage-matrix section: one `score` per Layer-1 standard, id
    `"<standardId>/conformance"` (the `row/col` convention #432 `coverageFromScores` pivots), `value`
    mapping severity onto 0..1 (OK → 1, GAP → 0.5, FAIL → 0) against `max: 1` so each cell tones
    positive/caution/critical. `findings[]` carries each non-conformant standard (FAIL → error, GAP →
    warn, with its `file:line` location) so the gap survives into SARIF/JUnit.
  - **`trend`** — the `--burndown` history as `series[]` (score% + FAIL/GAP counts over time). Confirms
    the #435 split note: the burndown series is **part of this reporter**, not a standalone one.
- **Wired into `--json`** ([we:scripts/check-app-conformance.mjs](../scripts/check-app-conformance.mjs)) under
  a `report` key alongside the legacy keys (additive). The burndown log is re-read in the JSON block so a
  co-passed `--burndown` point is reflected. The **terminal/ANSI path stays bespoke** per scope.
- **Pure helper** (no fs/process) so the CLI injects the loaded burndown entries and it's testable.
  **Tests** ([we:scripts/lib/__tests__/conformanceReport.test.mjs](../scripts/lib/__tests__/conformanceReport.test.mjs)):
  coverage scores + findings mapping, the series mapping (+ omitted when no history), a pivot through
  `coverageFromScores`, and model-validity via the #434 SARIF/JUnit adapters. 6/6 green; CLI smoke on
  `demos/auto-insurance` emits a valid report; `check:standards` 0 errors.
