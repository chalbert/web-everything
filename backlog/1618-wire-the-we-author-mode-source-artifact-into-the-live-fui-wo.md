---
kind: story
size: 5
parent: "746"
status: open
blockedBy: ["818"]
dateOpened: "2026-06-22"
tags: []
---

# Wire the WE author-mode-source artifact into the live FUI workbench (transport + declarative-component blocks)

Follow-up to #818 (the author-mode emit foundation, placement #954). The WE half ships: a `serve()`
build-emit (`we:scripts/gen-author-mode-source.mjs`) + committed, drift-tested `we:src/_data/authorModeSource.json`;
FUI ships the consuming output-tabs panel (`fui:workbench/authorMode.ts`, rendered by `fui:workbench/mount.ts`
when a `WorkbenchBlock` declares `authorSource`). Two residuals remain, both real wiring (no fork): **(1)
Transport** — feed the WE-committed artifact to the FUI registry without a hand-synced copy (a sibling
`../webeverything` build read or a published artifact) so the panel stays in sync with WE's `serve()` by
construction; **(2) Attachment** — the only workbench block today (`auto-complete`) is an imperative CEM
component with no declarative `<component>` definition, so nothing carries `authorSource` live yet; register
the `componentCases` declarative blocks (or attach author-source to blocks that have a definition). Only
rendered text + diagnostics cross the #700 seam (FUI never imports `serve()`).
