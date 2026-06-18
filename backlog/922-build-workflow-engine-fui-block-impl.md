---
type: issue
workItem: story
size: 8
parent: "904"
status: resolved
locus: frontierui
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/blocks/workflow-engine/NativeWorkflowEngine.ts
tags: []
---

# Build workflow-engine FUI block impl

Build the native-first workflow-engine in `fui:blocks/workflow-engine/` (contract: we:src/_data/blocks/workflow-engine.json). Dependency-free SCXML-style interpreter (steps + transitions + guards + parallel/fork-join + completion) threading context, tracking position, emitting {flow,from,to,context,at} step-transition; TIER-1 core + TIER-2 common operators with a declared supported set; ships CustomWorkflowEngineRegistry + a reference XState adapter. SIZE 8 — itself a future /slice (engine-core vs XState adapter) once the core surface exists. locus frontierui. Slice of #904 (#634/#650).

## Built — engine-core (batch-2026-06-18)

Shipped in **frontierui** at `blocks/workflow-engine/` (Module, no element):

- **`fui:workflowTypes.ts`** — the portable `WorkflowGraph`/`WorkflowStep`/`Transition`/`Guard`/`Assign`
  contract (`portableGraphIsTheLock`), `WorkflowEvent`/`WorkflowContext`/`WorkflowInstance`/
  `CustomWorkflowEngine`, `WorkflowOperator` + `TIER1_OPERATORS`/`TIER2_OPERATORS`,
  `StepTransitionDetail`, `STEP_TRANSITION_EVENT`/`WORKFLOW_COMPLETE_EVENT`.
- **`fui:NativeWorkflowEngine.ts`** — the dependency-free SCXML-style interpreter: atomic steps,
  guarded/assigning transitions, eventless auto-advance, top-level `final` → `workflow-complete`, and
  **parallel fork-join** (a `parallel` step forks branch heads into a join-group, joins when all
  branch-finals complete). Emits `{flow,from,to,context,at}` on every move (`transitionEventSeam`).
- **`fui:registry.ts`** — `CustomWorkflowEngineRegistry` + `customWorkflowEngine` (shared, native default).
- **`fui:xstateAdapter.ts`** — `toXStateConfig` (pure WorkflowGraph→XState v5 config, no xstate dep) +
  `XStateWorkflowAdapter` (the `CustomWorkflowEngine` seam; `createActor` injected, so FUI stays
  dependency-free — the full XState runtime is the deferred slice this item's note flagged).
- **FUI `fui:src/_data/blocks.json`** — new `workflow-engine` family entry (protocol webworkflows).

Scope = engine-core + the adapter SEAM (per #922's own "engine-core vs XState adapter" split); the
full XState-backed runtime stays a follow-up slice. Gate: `check:standards` green (0 errors; 34
blocks), 13 vitest specs pass, `tsc` clean.

**Follow-up:** the full XState-backed `XStateWorkflowAdapter` runtime (wire a real `createActor`,
context/guard/assign mapping) — the deferred engine-core-vs-adapter slice.
