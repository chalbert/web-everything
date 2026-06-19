---
type: idea
workItem: story
size: 3
parent: "1023"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webreporting conformance demo + concept-to-poc relabel

Single finish slice of webreporting impl epic #1023 — the standard is mostly built (report-model protocol contract shipped/registered; v1 renderers #432 + producer migration #435 resolved; SARIF/JUnit/coverage ingest + SARIF/JUnit export adapters complete), but the project is still labelled status:concept and has no dedicated conformance demo. Ship a runtime conformance demo exercising the report-model contract end-to-end (ingest a SARIF/JUnit/coverage source -> normalized Report -> render findings/coverage/trend/score), verify renderer+adapter coverage vs the spec, then relabel webreporting concept->poc (impl+tests exist, mirroring the weblifecycle/webaudit/webdecisions relabels). Resolves #1023 once shipped.
