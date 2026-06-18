---
type: idea
workItem: story
size: 2
parent: "350"
status: resolved
blockedBy: ["435"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: capability-manifest/report.ts
tags: []
---

# Migrate capability-manifest adherence onto the report model

Slice D of #435's reporter-migration fan-out: map the existing AdherenceReport (we:capability-manifest/report.ts) into a Report section partitioning declared/used/honoured/unused/outOfCapability, reusing the model shape from #435. formatAdherenceReport plain-text path stays.

## Progress (2026-06-15, batch-2026-06-15)

- **Authored `adherenceToReport(report)`** in [we:capability-manifest/report.ts](../capability-manifest/report.ts)
  — maps an `AdherenceReport` onto a #431 report-model `Report`. One `adherence` section partitions the
  buckets as `scores[]` (counts: declared / used / honoured / unused / outOfCapability + `missingCore`,
  `unit: features`, with `max` set where a denominator is meaningful), and `findings[]` carries the two
  reportable **defects** so they survive into SARIF/JUnit: each out-of-capability usage is an `error`
  (`ruleId: out-of-capability`), each missing Core feature a `warn` (`ruleId: missing-core-feature`). The
  headline `conformant` flag + spec/level ride on the source `meta`.
- **Reused the #431 model via a type-only import** (`import type { Report }` from
  `blocks/renderers/report/renderReport`) — erased at runtime, so this adds **no runtime dependency** from
  capability-manifest onto blocks; the TS compiler enforces the shape (the producer-side analogue of the
  #435 `buildReport()` runtime helper the `.mjs` reporters use). The **`formatAdherenceReport` plain-text
  path stays bespoke** per scope.
- **Tests** ([we:capability-manifest/__tests__/report.test.ts](../capability-manifest/__tests__/report.test.ts)):
  scores partition + source meta, the error/warn findings mapping, and model-validity via the #434
  SARIF/JUnit adapters. 9/9 green; targeted `tsc --noEmit` clean; `check:standards` 0 errors.
