---
kind: story
size: 5
parent: "912"
status: open
humanGate: { kind: setup, what: "Needs a frontierui session where the live :3001 dev server can be stopped/restarted: adding react/react-dom/vue as workbench devDeps forces a Vite dependency pre-bundle reload, and the acceptance is mounting a wrapper into the live workbench — both violate the standing don't-restart-the-dev-server rule. Re-confirmed blocked-in-fact twice (2026-06-19, 2026-06-20)." }
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
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

**Re-confirmed 2026-06-20 (batch-2026-06-20):** still blocked-in-fact. The frontierui dev server is live
on :3001 (HTTP 200) and `react`/`react-dom`/`vue` are still absent from `fui:package.json` — adding them
pre-bundles on that running server (the forbidden restart), and the acceptance is a live-on-:3001 mount
verification. Left for a focused frontierui session that owns the server lifecycle; not reattempted in the
batch.
