---
kind: story
size: 5
parent: "904"
status: resolved
locus: frontierui
blockedBy: ["922"]
dateOpened: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/blocks/wizard/WizardElement.ts
tags: []
---

# Build wizard FUI block impl

Build the `<wizard-flow>` element in `fui:blocks/wizard/` (contract: we:src/_data/blocks/wizard.json). Wire a portable workflow graph through the swappable customWorkflowEngine into the flow-progress UX; owns no orchestration (transitions/guards/completion stay on the engine) — renders current position, maps the engine's step-transition stream to per-step status (wait/process/finish/error), back() for undo. Composes the existing Stepper block. Needs the engine impl → blockedBy #922. locus frontierui. Slice of #904 (#651 slice A, #634/#650).

## Built (batch-2026-06-18)

Shipped in **frontierui** at `fui:blocks/wizard/`:

- **`fui:WizardElement.ts`** — the `<wizard-flow>` element + `registerWizard` (parameterized #841).
  Wires a portable `WorkflowGraph` through the swappable `customWorkflowEngine` (#922, built earlier
  this batch); owns **no orchestration** (the engine decides position). Maps the engine's
  `step-transition` stream to per-step status (wait/process/finish/error), **composes StepperBehavior**
  for linear presentation (`aria-current="step"`, one-panel switching, Step-N-of-M announcement), and
  `back()` is **wizard-side history** — replays all-but-last sent event on a fresh instance (the engine
  is forward-only; history is TIER-3 per #922). Tracks the authoritative position from the transition
  `to` (the engine emits before its `active` set updates).
- **FUI `fui:src/_data/blocks.json`** — new `wizard` family entry (protocol webworkflows).

Cascade-freed by #922 (workflow-engine) landing earlier this batch; composes the existing Stepper
block. Gate: `check:standards` green (0 errors; 37 blocks), 5 vitest specs pass, `tsc` clean.
