---
kind: task
parent: "1250"
locus: frontierui
status: resolved
blockedBy: ["1299"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:blocks/traits/"
tags: []
---

# Migrate fui:traits/temporal/workflow-engine target → ownerElement

Flip this.target → this.ownerElement across fui:blocks/traits, fui:blocks/temporal, fui:blocks/workflow-engine (8 CustomAttribute subclasses) + tests, after #1299's alias lands. Part of the #1299 webbehaviors carve.

## Progress

- Flipped `this.target` → `this.ownerElement` (31 occurrences) across the **7 genuine CustomAttribute
  subclasses**: `fui:blocks/traits/Highlight.ts`, `fui:blocks/traits/Revealable.ts`,
  `fui:blocks/traits/Polling.ts`, `fui:blocks/traits/Sortable.ts`,
  `fui:blocks/temporal/traits/Clock.ts`, `fui:blocks/temporal/traits/CalendarGrid.ts`,
  `fui:blocks/temporal/traits/RangeCoordination.ts` (all `extends CustomAttribute`, no own `target`
  field).
- **Excluded `fui:blocks/workflow-engine/NativeWorkflowEngine.ts`** — the body's "8 subclasses" miscounted
  it. It is NOT a CustomAttribute; its `this.target` (lines 121/137) refers to its **own**
  `readonly target: EventTarget` field (`this.target.dispatchEvent(...)`), and `t.target`/`step.target`
  are transition state-ids. A blind flip would have broken the engine. Left untouched.
- Full FUI suite green — 2425 passed / 9 skipped / 0 failed (incl. workflow-engine + temporal suites).
