---
type: idea
workItem: story
size: 5
parent: "912"
status: open
blockedBy: ["1029"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, workbench, polyglot]
---

# Workbench same-document live-test mount + react/vue devDeps

fui:workbench/live-test/: await import('/_maas/<block>.js?form=react-wrapper'), mount into the workbench document (no iframe — #955-A2), React error boundary + window.onerror/unhandledrejection runtime-error surfacing, wired to inspector/event/anatomy panels; add react/react-dom/vue as workbench devDeps (never the shipped @frontierui bundle — framework-free, #955-B).

## Dropped from batch-2026-06-19 (cascade-freed by #1029, but live FUI dev server)

Cascade-freed when #1029 resolved (its `blockedBy`), and the workbench panels it wires into exist in
`fui:workbench/mount.ts`. Deferred for the same live-dev-server class as siblings #449/#1046: this item's
acceptance is mounting a **react/vue wrapper into the live workbench on :3001** (verified live, PID 19026),
and adding `react`/`react-dom`/`vue` as workbench devDeps triggers Vite dependency pre-bundling on that
running server — a disruptive reload the dev-server instruction forbids ("leave servers as you found them").
It is also a deep cross-repo integration into the 947-line `fui:workbench/mount.ts` (live-test mount + React
error boundary + `window.onerror`/`unhandledrejection` surfacing + inspector/event/anatomy panel wiring) that
wants a focused `fui:` session. Resume via `/next 1030` in frontierui where the dev server can be restarted
after `npm install`.
