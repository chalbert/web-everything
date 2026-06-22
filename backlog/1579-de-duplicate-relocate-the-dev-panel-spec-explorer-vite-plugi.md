---
kind: story
size: 3
status: open
dateOpened: "2026-06-22"
tags: []
---

# De-duplicate + relocate the dev-panel / spec-explorer Vite plugin to Plateau

Per #1565 (we:docs/agent/platform-decisions.md#devtools-placement): the spec-explorer / dev-panel Vite plugin is byte-duplicated across we:tools/dev-panel/ and fui:tools/dev-panel/ (project_dev_panel_plugin_duplicated). It is an operated dev surface → Plateau. Relocate AND de-duplicate. Sub-question for this slice: Plateau-owned single copy vs a shared package each dev server (WE :3000, FUI :3001) consumes — pick the one that keeps both dev servers working with zero lock-in.
