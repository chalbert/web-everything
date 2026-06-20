---
kind: epic
parent: "1008"
status: resolved
dateOpened: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "project:webreporting"
tags: []
---

# webreporting implementation — finish renderers plus ingest/export adapters

Implementation epic for the webreporting standard. Design lineage: #350 / #431 (report-model protocol). Partially built — the report-model protocol already has a real impl; scope is FINISH (renderers plus ingest/export adapters), not start. Contract stays/extends in @webeverything, renderers/adapters runtime to FUI. Carved from the #1008 triage roadmap.

**Investigated → mostly built.** Contract shipped (the report-model protocol is registered), v1 renderers #432 + producer migration #435 both **resolved**, and SARIF/JUnit/coverage **ingest** + SARIF/JUnit **export** adapters complete (`we:blocks/renderers/report/renderReport.ts`, `we:blocks/adapters/report/ingestReport.ts`, `we:blocks/adapters/report/exportReport.ts`, `we:capability-manifest/report.ts`, all with unit tests). The only gaps: **no conformance demo** and the project is still `status: concept` (stale — impl+tests exist). **Sliced to one finish slice:** #1063 (conformance demo + verify renderer/adapter coverage + concept→poc relabel, mirroring the weblifecycle/webaudit/webdecisions relabels). #1023 resolves once #1063 ships.
