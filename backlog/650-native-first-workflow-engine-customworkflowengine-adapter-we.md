---
kind: story
size: 5
status: resolved
blockedBy: []
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "block:workflow-engine (blocks/workflow-engine/) — native-first CustomWorkflowEngine (TIER-1+2 operators, SCXML-style graph, step-transition event) + registry seam + reference XStateWorkflowAdapter, #634/webworkflows"
tags: []
---

# Native-first workflow engine + CustomWorkflowEngine adapter (webworkflows)

Build the native-first default workflow engine behind the CustomWorkflowEngine provider seam ratified in #634, plus a reference library adapter (XState or SCION) registered as an alternative impl. The engine reads/writes the portable SCXML-style orchestration graph (steps + transitions + guards + parallel/fork-join + completion), threads context, and emits the { flow, from, to, context, at } step-transition event. Honors Tier-1 core + Tier-2 common operators and declares its supported set via the #085-style compliance matrix. This is the runtime that makes the Web Workflows protocol real.

## Progress

- Built the `workflow-engine` runtime Module under [blocks/workflow-engine/](/blocks/workflow-engine/):
  - [we:NativeWorkflowEngine.ts](/blocks/workflow-engine/NativeWorkflowEngine.ts) — the dependency-free native-first default. Interprets the portable SCXML-style `WorkflowGraph`, threads context, tracks the current position, and emits `{ flow, from, to, context, at }` step-transition events. Honors **TIER-1** (sequence, branch/guard, nest sub-workflow, threaded context, completion, current-position) + **TIER-2** (parallel fork/join, back/undo, gate/wait-for-event); declares `supports` (the #085 compliance posture).
  - [we:types.ts](/blocks/workflow-engine/types.ts) — `WorkflowGraph`/`WorkflowStep`/`Transition`/`Guard`/`Assign`, the `CustomWorkflowEngine` provider contract, the tiered `WorkflowOperator` vocabulary, `StepTransitionDetail`.
  - [we:registry.ts](/blocks/workflow-engine/registry.ts) — `CustomWorkflowEngineRegistry` + the shared `customWorkflowEngine` seam (native pre-registered as default, `define`/`resolve`/`setDefault`).
  - [we:adapters/XStateWorkflowAdapter.ts](/blocks/workflow-engine/adapters/XStateWorkflowAdapter.ts) — the **reference library adapter** (the "XState or SCION" pick → **XState**, the mature SCXML-aligned default; SCION plugs in identically). Written against a minimal injected `XStateLike` surface so the native runtime stays dependency-free — it demonstrates the graph→machine mapping (`toXStateConfig`) without bundling XState.
- Registered in [fui:src/_data/blocks.json](/src/_data/blocks.json) (type `Module`, SCXML/CustomEvent standards, `step-transition`/`workflow-complete` events, designDecisions) + description partial [we:src/_includes/block-descriptions/workflow-engine.njk](/src/_includes/block-descriptions/workflow-engine.njk).
- 14 unit tests ([we:__tests__/workflow-engine.test.ts](/blocks/workflow-engine/__tests__/workflow-engine.test.ts)) — every TIER-1 + TIER-2 operator, the transition-event shape, the registry seam, and the XState adapter via a structural fake; all green. `tsc --noEmit` clean for the block; `check:standards` green (64 blocks); 11ty build smoke green.
- **Decision recorded:** the reference-adapter library pick (XState vs SCION) was a POC-mode reference-impl choice, not a standard fork — defaulted to XState per native-first/most-mature, SCION documented as the identical alternative. The native engine is the real deliverable.
