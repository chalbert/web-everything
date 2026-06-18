---
type: issue
workItem: story
size: 5
status: open
locus: frontierui
blockedBy: ["935"]
dateOpened: "2026-06-18"
tags: [webworkflows, workflow-engine, xstate, adapter]
---

# Map parallel/fork-join onto XState parallel regions in the workflow runtime

Follow-up carved out of **#935** (the real XState runtime). #935 ships the XState-backed
`CustomWorkflowEngine` at outcome-parity with the native engine for the **sequential** operators
(transition/guard/assign/final/eventless/on-entry), and **throws** on a parallel step rather than
silently diverging (`fui:blocks/workflow-engine/xstateRuntime.ts`). This item maps the remaining
`parallel`/`fork-join` operator: the native engine models parallel branches as **flat top-level step
ids** with a custom join counter (`NativeWorkflowInstance` groups/`finalize`), whereas XState wants
**nested parallel regions** with `onDone` — so the runtime must extract each branch's reachable subgraph
into a region and translate the join to the parallel state's `onDone` target. Done when the XState
adapter reaches outcome-parity with the native engine on the parallel fixtures too, and `supports()`
re-adds `parallel`/`fork-join`.
