---
kind: task
parent: "1522"
locus: plateau-app
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: "plateau-app:tools/explorer/oracles/layoutShift.ts (no-excessive-cls advisory oracle) + playwrightCollector.ts (bounded PerformanceObserver CLS read)"
tags: []
---

# Explorer: perf / layout-shift (CLS) signal + oracle

No runtime-perf or layout-shift signal is collected. Add a bounded PerformanceObserver read into the Observation and an advisory CLS oracle.

## Lineage
Surfaced 2026-07-01 in the first #1522 (Explorer CLI autonomy) goal-completeness pass — perf/CLS was an unfiled issue-class (no runtime-perf signal collected). Report: [we:reports/2026-07-01-program-explorer-cli-autonomy.md](../reports/2026-07-01-program-explorer-cli-autonomy.md).
