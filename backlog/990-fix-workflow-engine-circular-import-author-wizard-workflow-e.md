---
kind: story
size: 3
parent: "972"
locus: frontierui
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:demos/workflow-engine-demo.html (+ wizard-demo.html)"
tags: []
---

# Fix workflow-engine circular import + author wizard/workflow-engine FUI demos

Carved from #981 (which shipped the stepper demo). Two coupled blocks remain demo-less because of a real defect found in batch-2026-06-18: fui:blocks/workflow-engine/NativeWorkflowEngine.ts re-exports customWorkflowEngine from fui:blocks/workflow-engine/registry.ts, and fui:blocks/workflow-engine/registry.ts both imports NativeWorkflowEngine AND instantiates new NativeWorkflowEngine() at module top level — a load-time import cycle. It is benign under vitest but in a browser/Vite ESM graph the registry module evaluates before the class finishes initialising, throwing 'Cannot access NativeWorkflowEngine before initialization', so the workflow-engine entry (and the wizard, which imports it) is un-importable in the browser. FIX the cycle safely (e.g. lazy-seed the native default in fui:blocks/workflow-engine/registry.ts, or relocate the customWorkflowEngine singleton to a third module that imports both) WITHOUT removing the re-export (7 unit tests import customWorkflowEngine/CustomWorkflowEngineRegistry through NativeWorkflowEngine — a naive removal breaks them). THEN author fui:demos for wizard (<wizard-flow> over a portable WorkflowGraph) and workflow-engine (NativeWorkflowEngine send/current state machine) and wire demoFile. locus frontierui.

## Progress (batch-2026-06-18) — resolved

**Cycle fix (lazy-seed, the body's first option).** `fui:blocks/workflow-engine/registry.ts` no longer
constructs `new NativeWorkflowEngine()` at module-eval. A `DefaultWorkflowEngineRegistry` subclass seeds
the native default **on first access** (overrides `register`/`get`/`resolve`/`names`/`default` →
`ensureSeeded()`), so the only `new NativeWorkflowEngine()` runs after every module has finished
evaluating — past the class's TDZ. The re-export stays intact (the cycle remains but is now benign, in
the browser too). Semantics preserved: native is seeded *before* any app engine, so an app engine only
takes the default if it asks (`ensureSeeded` runs at the top of `register`).

**Verified.** All 33 unit tests pass (workflowEngine 13, wizard 5, xstateRuntime 15 — the xstate tests
register extra engines, confirming the seed-first semantics). Real-browser check on the frontierui dev
server (`:3001`) for **both** new demos: load with **zero console/page errors** — the
`Cannot access 'NativeWorkflowEngine' before initialization` crash is gone in the Vite ESM graph (the
whole point). The order flow drives cart→payment→confirmed→shipped→`workflow-complete`; the wizard
advances account→profile→review.

**Demos shipped + wired** (`demoFile` in `fui:src/_data/blocks.json`):
- `fui:demos/workflow-engine-demo.html` — NativeWorkflowEngine `send`/`current` over a portable order
  graph, with the legal-moves controls + a live transition log (resolves the engine via the swappable
  `customWorkflowEngine` seam; never names a vendor).
- `fui:demos/wizard-demo.html` — `<wizard-flow>` over a portable signup graph; engine-driven transitions,
  per-step status, wizard-side Back.

**Gate hygiene.** Emptied the `DEMO_PENDING` allowlist in `fui:scripts/check-standards.mjs` (it held
exactly these two, carved here) — all 37 registered blocks are now demo-complete. `check:standards`
green (0 errors).
