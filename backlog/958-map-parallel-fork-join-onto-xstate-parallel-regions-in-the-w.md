---
type: issue
workItem: story
size: 5
status: resolved
locus: frontierui
blockedBy: ["935"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: "fui:blocks/workflow-engine/xstateRuntime.ts"
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

## Progress (batch-2026-06-18) — resolved

Mapped onto XState v5 nested parallel regions in `frontierui` (locus). Shared the subgraph extraction as
a pure helper `partitionParallel(graph)` in `fui:blocks/workflow-engine/xstateAdapter.ts`: per `parallel`
step it BFS-extracts each branch's reachable subgraph (bounded by the join so a branch can't absorb it)
into a region, and surfaces `branchStepIds` + `branchFinalIds`.

- **Runtime** (`fui:blocks/workflow-engine/xstateRuntime.ts`): `buildMachine` no longer throws on a
  `parallel` step — it builds a `type:'parallel'` state whose regions are the branch subgraphs (each a
  nested sub-statechart ending at its branch-`final`), with the parallel state's `onDone` taking the join
  target. Factored the per-step node build into `buildNode` so top-level and region states share it.
- **Adapter** (`xstateAdapter.ts`): `activeIds` now recurses the parallel value to the leaf step ids
  (was `Object.keys`, which surfaced region containers). The key parity subtlety: a closed branch's final
  lingers in XState's region value until the join fires, but the native engine drops it from `current()`
  immediately — so `current()`/the event bridge filter `branchFinalIds`. `supports()` re-adds
  `parallel`/`fork-join`. `toXStateConfig` now emits proper nested regions + `onDone` (was an invalid flat
  `type:'parallel'`).
- **Tests**: replaced the #935 "throws on parallel" scope test with 6 parallel parity fixtures (immediate
  finals, event-driven branches, branch-close-drops-from-current, join+context threading, non-final join
  the flow continues past) + the updated `supports()` assertion. 28 workflow-engine tests green.

Outcome parity holds with the native flat-branch + join-counter model. FUI `check:standards` clean for
this changeset (the lone error, `plugs/webvalidation/`, is concurrent #950 work — not in this changeset).
Residual: concurrent writes to the *same* context key across branches are order-sensitive and could
diverge — an ill-formed concurrent graph the conformance fixtures avoid (branches write independent keys).
