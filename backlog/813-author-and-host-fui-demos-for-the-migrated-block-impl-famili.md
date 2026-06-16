---
type: issue
workItem: story
size: 5
parent: "658"
locus: frontierui
status: open
dateOpened: "2026-06-16"
tags: []
---

# Author and host FUI demos for the migrated block-impl families as fuiDemo iframe targets

Prerequisite for #697's WE-side cutover. WE's fuiDemo shortcode (.eleventy.js:38) iframes FUI_DEMO_BASE/demos/<file>, but FUI's demos/ hosts NO demo for the 9 migrated block-impl families (background-task-surface, data-grid, type-ahead, audit, lifecycle, master-detail, selection, stepper, tree-select) — so every cutover iframe points at a 404 today. Author + host a runtime demo per block-impl family in frontierui/demos/ (locus:frontierui), serving on :3001 / the published demos host, so WE can swap block.fuiDemo to the FUI-hosted file and delete its local demo. Scope = the standalone block-impl demos (background-task-surface-demo, data-grid-demo, durable-tier surface); the exercise-app composition path is the separate #812 fork. Blocks the #697 cutover.
