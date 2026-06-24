---
kind: story
size: 2
status: resolved
locus: plateau-app
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1280
tags: [plateau, gate, render-conformance]
---

# plateau render-conformance gate red since #1597: the neutral conformance runner flagged as an untracked density-0 surface

The plateau:src/render-conformance.test.ts gate (#1280) has failed since #1597 landed plateau:src/conformance-engine/conformanceVectors.ts: the gate scans src for rendered surfaces and flags plateau:src/conformance-engine/conformanceVectors.ts as untracked with density 0 — but it is the neutral conformance runner, a non-rendering module, not a product surface. So the gate reds the whole plateau npm test suite (1 failed) and stays red across sessions (worked around throughout batch-2026-06-23-1689-1500). Fix (locus plateau): either exclude density-0 / non-rendering modules from the render-conformance surface scan, or add the runner (and siblings) to the committed baseline so the gate gives once landed (#1280's give-preserve intent). Low-risk gate hygiene; unblocks a green plateau suite.

## Progress (batch-2026-06-23-1725-1665) — DONE

Fixed the false positive. `plateau:scripts/check-render-conformance.mjs` flagged `plateau:src/conformance-engine/conformanceVectors.ts` as an untracked density-0 "landed surface" because it imports `@frontierui` — but it imports the FUI `ConformanceBinding` **contract** (a type), it never renders product chrome. Added an `EXCLUDED_DIRS` set excluding the `conformance-engine/` infra dir from the surface scan.

Chose dir-exclusion over "exclude all density-0" deliberately: a fully-migrated product surface is *also* density-0 (the goal state) and must stay tracked, so excluding density-0 wholesale would un-track exactly the surfaces the gate should preserve. The conformance engine is audit/runner infra (#1597), not a product UI surface. Verified: gate report now `untracked: []`, `regressions: []`, 16 landed; the whole plateau suite is green (**55 files / 450 tests**, was 1 failed since #1597). No baseline orphans (no conformance-engine entries existed).
