---
kind: story
size: 3
parent: "1023"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:demos/webreporting-conformance-demo.ts"
tags: []
---

# webreporting conformance demo + concept-to-poc relabel

Single finish slice of webreporting impl epic #1023 — the standard is mostly built (report-model protocol contract shipped/registered; v1 renderers #432 + producer migration #435 resolved; SARIF/JUnit/coverage ingest + SARIF/JUnit export adapters complete), but the project is still labelled status:concept and has no dedicated conformance demo. Ship a runtime conformance demo exercising the report-model contract end-to-end (ingest a SARIF/JUnit/coverage source -> normalized Report -> render findings/coverage/trend/score), verify renderer+adapter coverage vs the spec, then relabel webreporting concept->poc (impl+tests exist, mirroring the weblifecycle/webaudit/webdecisions relabels). Resolves #1023 once shipped.

## Progress

Shipped the finish slice of #1023:
- Runtime conformance demo `we:demos/webreporting-conformance-demo.{html,ts,css}` — ingests SARIF /
  JUnit / Istanbul-coverage fixtures through `fromSarif`/`fromJUnit`/`fromCoverage` → the normalized
  `Report` pivot → the shared v1 renderers (`renderFindingsTable`, `renderCoverageMatrix` via
  `coverageFromScores`), with the `toSarif`/`toJUnit` export round-trip. 8 conformance invariants + a
  live-render section. Registered in `we:src/_data/demos.json` (project: webreporting).
- Relabelled webreporting `concept`→`poc` in `we:src/_data/projects.json` (mirrors the
  weblifecycle/webaudit/webdecisions relabels; impl + tests exist).
- **Browser-verified** (Playwright on the live :3000 page): `playgroundReady`, 8/8 invariants hold, 2
  live render tables, zero console errors. `check:standards` 0 owned errors.

Resolves #1023 (the standard is built + demoed + relabelled).
