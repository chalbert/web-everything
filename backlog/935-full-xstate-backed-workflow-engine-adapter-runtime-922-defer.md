---
kind: story
size: 5
status: resolved
locus: frontierui
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: blocks/workflow-engine/xstateRuntime.ts
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

## Progress (batch-2026-06-18) — resolved

- **Real runtime.** New `fui:blocks/workflow-engine/xstateRuntime.ts` — the **only** module importing
  `xstate` — builds a genuine XState v5 machine from the portable `WorkflowGraph`: step → state,
  transition → `on`/`always` (multiple per event → ordered array, first passing guard wins),
  `guard(ctx,event)` → XState `guard`, `assign`/`onEntry` → XState `assign` actions, `final` → final
  state. Exposes `createXStateActor(graph)`, the factory injected into the adapter.
- **Seam completed.** `fui:.../xstateAdapter.ts`: the injected factory now takes the **graph** (the
  runtime needs the live guard/assign fns, not just the serializable config); `create()` **bridges the
  snapshot stream** to `step-transition` (`{flow,from,to,context,at}`, `from:'(start)'` first) +
  `workflow-complete` on the instance target, gated so no spurious pre-start emission. `toXStateConfig`
  (pure mapping) unchanged + still tested.
- **Parity proven.** `fui:.../__tests__/xstateRuntime.test.ts` runs the native engine and the XState
  adapter over the same graphs + event scripts, asserting **outcome parity** (final position + context +
  done) across transition/guard/assign/eventless/on-entry — parity is outcome-based, not identical event
  streams (XState settles eventless chains before emitting; documented).
- **Honest scope.** `supports()` advertises only the sequential operators it honors at parity; the runtime
  **throws** on a `parallel` step (no silent divergence) — parallel→XState-regions carved to **#958**
  (`blockedBy: 935`). xstate is a **peer/optional dep** (`fui:package.json` `peerDependencies` +
  `peerDependenciesMeta.optional`; dev-installed for tests) so FUI's `NativeWorkflowEngine` default stays
  dependency-free.
- 23/23 workflow-engine tests pass, `tsc --noEmit` clean, FUI `check:standards` green.
