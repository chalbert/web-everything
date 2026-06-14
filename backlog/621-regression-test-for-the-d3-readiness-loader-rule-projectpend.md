---
type: issue
workItem: task
status: resolved
blockedBy: ["608"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
tags: []
---

# Regression test for the D3-readiness loader rule (projectPending demotion)

The #608 D3-readiness rule lives in the loader (src/_data/backlog.js): an open issue/idea whose relatedProject is a concept project with zero shipped surface gets projectPending=true and is demoted out of Tier A. The loader has no direct unit test (engine.test.mjs covers computeSelection over synthetic items, not the loader's projectPending derivation). Add a focused regression test asserting: (a) a concept project with 0 resolved items demotes its open builds to Tier C; (b) a concept project WITH resolved surface does NOT demote (status-drift, not pending — the #613/#617 precision); (c) relatedProjectStatus is populated. Guards the forward-gate behavior against silent regressions.
