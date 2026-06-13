---
type: idea
workItem: story
size: 3
parent: "350"
status: resolved
blockedBy: ["431"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: blocks/adapters/report/ingestReport.ts
tags: []
---

# Build the v1 ingest adapters — SARIF, JUnit, coverage

Build the first ingest adapters: external format → report model for SARIF, JUnit, and coverage JSON, so any producer's output displays in the shared renderers. The lossy-normalization-hub pattern — ingest each foreign format bottom-up into the pivot the project never ships. SonarQube and lint/audit JSON follow. Phase 3 of #350; targets the report model (#431).

## Resolved 2026-06-13 (batch-2026-06-13)

Built the three v1 ingest adapters in
[blocks/adapters/report/ingestReport.ts](../blocks/adapters/report/ingestReport.ts) — the inverse of the
#434 export adapters, targeting the #431 `report-model` schema. Pure functions, no I/O.

- **`fromSarif`** — SARIF 2.1.0 log → Report: one `ReportSource` + `ReportSection` per `run`, one
  `Finding` per `result` (`level` → severity via `sarifLevelToSeverity`, `physicalLocation` → location,
  `ruleId` carried). Lossy by design — SARIF carries only the tool name, so the source is keyed by name.
- **`fromJUnit`** — JUnit XML → Report (regex parse, no DOM): one section per `<testsuite>`, one finding
  per `<testcase>`; a `<failure>`'s `type` recovers the original severity (default `error`), a passing
  case → `pass`; XML entities unescaped.
- **`fromCoverage`** — Istanbul/nyc `coverage-summary.json` → Report: per-file × per-metric `Score`s keyed
  `"<file>/<metric>"` (basename rows, since the matrix splits ids on `/`) so `coverageFromScores` pivots
  them straight into the coverage matrix.

Tests: [blocks/__tests__/unit/adapters/reportIngest.test.ts](../blocks/__tests__/unit/adapters/reportIngest.test.ts)
— 8 tests, incl. an export→ingest round-trip; the report adapters suite is **17/17 green**.

> **Close-out gate note:** the ingest work is independently green (its own tests pass, no `check:standards`
> error references these files). The two residual `check:standards` errors at resolve time
> (`#396`/`#475` stories missing `size`) are provably **external** — a concurrent session's in-flight
> design-ref-vision WIP, unrelated to this change. SonarQube + lint/audit ingest follow as noted.
