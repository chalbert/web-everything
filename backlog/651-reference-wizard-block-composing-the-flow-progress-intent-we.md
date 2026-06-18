---
type: issue
workItem: epic
status: resolved
blockedBy: ["650"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: none
tags: []
---

# Reference wizard Block composing the Flow Progress intent (webworkflows)

Umbrella for the reference wizard/flow Block that composesIntents over the Flow Progress intent ratified in #634 — the canonical multi-step UX (current position + per-step status + register) rendered against a real CustomWorkflowEngine — **and** the runtime demo that proves the Web Workflows protocol + Flow Progress intent compose end-to-end in a browser. The Block defaults to the wizard register; demonstrates back/undo (Tier-2), per-step status (wait/process/finish/error), and aria-current=step; reuses navigation's structure:linear/guard/history rather than reinventing them.

## Sliced into an epic (2026-06-15, `/split 651`)

Originally a `story·13`. Both heavy substrates are shipped — the `CustomWorkflowEngine` (#650, resolved;
`customWorkflowEngine.resolve().start(graph)` → `WorkflowInstance` with `send/back/onTransition/onComplete`),
the ratified `flow-progress` intent (#634, `we:src/_data/intents.json`), and `StepperBehavior`
(`we:blocks/stepper/StepperBehavior.ts`) — so the `size` was wiring-of-shipped-pieces, not a buried fork. The
card's own body named the seam: **the wizard Block, then its runtime demo.** Split along that seam (analysis:
[we:reports/2026-06-15-backlog-split-analysis.md](../reports/2026-06-15-backlog-split-analysis.md)):

- **A — #691** (`story·3`) — the interactive wizard **Block** (NEW `blocks/wizard/` custom element wiring
  the engine + StepperBehavior into a Flow-Progress UX). Unblocked (#650 ✓).
- **B — #692** (`story·3`, blockedBy #691) — the **runtime demo** proving it end-to-end (new demo page +
  `we:demos.json` registration + dev-server fallback + e2e/render check). new-demo-class work.

DAG: **A → B** (incremental; the demo consumes the Block element). Watch-item: if A re-estimates >3 in
webworkflows context, sub-slice A1 element+stepper / A2 status+back/undo.
