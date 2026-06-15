---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["650"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
tags: []
---

# Reference wizard Block composing the Flow Progress intent (webworkflows)

Build the concrete wizard/flow Block that composesIntents over the Flow Progress intent ratified in #634 — the canonical multi-step UX (current position + per-step status + register) rendered against a real CustomWorkflowEngine. Defaults to the wizard register; demonstrates back/undo (Tier-2), per-step status (wait/process/finish/error), and aria-current=step. Reuses navigation's structure:linear/guard/history rather than reinventing them. The runtime demo that proves the Web Workflows protocol + Flow Progress intent compose end-to-end in a browser.

## Outgrew a clean batch slice (2026-06-15, batch pre-flight) — needs a focused build

Claimed in a batch (cascade top-up, freed by #650's `workflow-engine` block) and scoped against the real
tree before any edit. The infrastructure is all present and usable — `flow-progress` intent, the
`blocks/workflow-engine/` `CustomWorkflowEngine` (`customWorkflowEngine.resolve().start(graph)` →
`WorkflowInstance` with `send/back/onTransition/onComplete`), and `StepperBehavior` to compose — so this is
**not blocked**. But the card bundles **two deliverables**: (1) a new *interactive* wizard **Block** (a custom
element wiring the engine to a Flow-Progress UX — current position, per-step status, `aria-current=step`,
back/undo, transition rendering) **and** (2) a **runtime demo** proving it end-to-end in a browser (new demo
page + `demos.json` registration + dev-server fallback + an e2e/render check). That is new-demo-class work
(≈`story·8` in practice, not `5`) — bigger than one clean batch slice. Released unworked; the batch stopped
here (stop rule 4). **Recommend a focused `/new-demo`-style session** (or split: the wizard Block, then its
runtime demo). All blockers are resolved, so it's ready the moment it's picked up with webworkflows context.
