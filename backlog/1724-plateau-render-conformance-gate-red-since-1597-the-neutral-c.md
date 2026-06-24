---
kind: story
size: 2
status: open
locus: plateau-app
dateOpened: "2026-06-24"
tags: [plateau, gate, render-conformance]
---

# plateau render-conformance gate red since #1597: the neutral conformance runner flagged as an untracked density-0 surface

The plateau:src/render-conformance.test.ts gate (#1280) has failed since #1597 landed plateau:src/conformance-engine/conformanceVectors.ts: the gate scans src for rendered surfaces and flags plateau:src/conformance-engine/conformanceVectors.ts as untracked with density 0 — but it is the neutral conformance runner, a non-rendering module, not a product surface. So the gate reds the whole plateau npm test suite (1 failed) and stays red across sessions (worked around throughout batch-2026-06-23-1689-1500). Fix (locus plateau): either exclude density-0 / non-rendering modules from the render-conformance surface scan, or add the runner (and siblings) to the committed baseline so the gate gives once landed (#1280's give-preserve intent). Low-risk gate hygiene; unblocks a green plateau suite.
