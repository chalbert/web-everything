---
type: idea
workItem: story
size: 5
status: open
locus: frontierui
dateOpened: "2026-06-18"
tags: [webworkflows, workflow-engine, xstate, adapter]
---

# Full XState-backed workflow-engine adapter runtime (#922 deferred slice)

Complete the `XStateWorkflowAdapter` (`fui:blocks/workflow-engine/xstateAdapter.ts`) into a real
XState-backed `CustomWorkflowEngine`: #922 shipped the engine-core + the adapter SEAM
(`toXStateConfig` pure mapping + an injected-`createActor` stub that throws without xstate). This slice
wires a genuine XState v5 runtime — map guards/assign/context onto XState actions, bridge its snapshot
stream to the `step-transition`/`workflow-complete` events, and prove parity with the native engine
over the same portable `WorkflowGraph`. Keep xstate a peer/optional dep so FUI's default stays
dependency-free. This is the "engine-core vs XState adapter" split #922 flagged once the core existed.
