---
type: issue
workItem: story
size: 8
parent: "904"
status: open
locus: frontierui
dateOpened: "2026-06-18"
tags: []
---

# Build workflow-engine FUI block impl

Build the native-first workflow-engine in `fui:blocks/workflow-engine/` (contract: we:src/_data/blocks/workflow-engine.json). Dependency-free SCXML-style interpreter (steps + transitions + guards + parallel/fork-join + completion) threading context, tracking position, emitting {flow,from,to,context,at} step-transition; TIER-1 core + TIER-2 common operators with a declared supported set; ships CustomWorkflowEngineRegistry + a reference XState adapter. SIZE 8 — itself a future /slice (engine-core vs XState adapter) once the core surface exists. locus frontierui. Slice of #904 (#634/#650).
