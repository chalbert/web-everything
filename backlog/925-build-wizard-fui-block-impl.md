---
type: issue
workItem: story
size: 5
parent: "904"
status: open
locus: frontierui
blockedBy: ["922"]
dateOpened: "2026-06-18"
tags: []
---

# Build wizard FUI block impl

Build the `<wizard-flow>` element in `fui:blocks/wizard/` (contract: we:src/_data/blocks/wizard.json). Wire a portable workflow graph through the swappable customWorkflowEngine into the flow-progress UX; owns no orchestration (transitions/guards/completion stay on the engine) — renders current position, maps the engine's step-transition stream to per-step status (wait/process/finish/error), back() for undo. Composes the existing Stepper block. Needs the engine impl → blockedBy #922. locus frontierui. Slice of #904 (#651 slice A, #634/#650).
