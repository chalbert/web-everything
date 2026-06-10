---
type: issue
workItem: story
size: 5
status: resolved
blockedBy: ["214", "215"]
dateOpened: '2026-06-09'
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: async-validator-field
tags:
  - validation
  - registry
  - async
  - runtime-plug
  - native-first
relatedReport: reports/2026-05-30-form-validation-standard-assessment.md
relatedProject: webvalidation
parent: "004"
---

# Runtime `customValidatorResolution` plug + async-field element integration

The async sibling of #215. #214 shipped the dependency-free `validator-resolution/`
model (the `CustomValidatorResolutionRegistry` + `CustomValidatorResolution` contract,
the **versioning**/**cancellation** strategies, and the `AsyncValidationRunner`). What
it does **not** ship is the live counterpart: a real `window.customValidatorResolution`
registry plug resolved per-scope through the injector chain, and a form-associated
control that drives the runner so a stale in-flight check is reconciled and the
surviving answer flows into the `async` source of #215's `<validity-merge-field>`.

**Build:**
- A runtime plug (mirroring #215's `CustomValidityMergeRegistry.ts` runtime plug) that
  exposes `customValidatorResolution`, extends the shared `CustomRegistry`, and
  participates in nearest-scope-wins resolution.
- Wire the `AsyncValidationRunner`'s `emit` sink into the #215 `ValiditySourceOrchestrator`
  (`set('async', source)`) so `pending{version}` → `valid|invalid` lands on
  `ElementInternals.setValidity` for free.
- Runtime-conformance assertions (peer to #215's): versioning drops a superseded
  generation; cancellation aborts the in-flight `fetch`; per-scope resolution; the
  emitted source conforms to the cross-plane contract.

Sibling to #215; consumes the #214 model unchanged. See #004 OP-1/OP-11.

## Progress

- **Status:** resolved (2026-06-10)
- **Runtime plug — `plugs/webvalidation/CustomValidatorResolutionRegistry.ts`:** mirrors #215's
  `CustomValidityMergeRegistry` exactly — extends the core `CustomRegistry<CustomValidatorResolution>`
  (so it is injector-chain-resolvable + inheritable via `extends`), with `define(strategy, asDefault?)`
  / `defaultKey` / `resolve(key?)` (throws `UnknownResolutionError`). `createDefaultValidatorResolutionRegistry()`
  ships **versioning** (native-first default) + **cancellation**. Consumes the #214 model unchanged.
- **Async-field element — `plugs/webvalidation/AsyncValidatorField.ts` (`<async-validator-field>`):**
  resolves `customValidatorResolution` per-scope (`InjectorRoot.getProviderOf` → `window` fallback,
  same path as the merge field), builds an `AsyncValidationRunner`, and wires the runner's `emit` sink
  into a target `<validity-merge-field>`'s `async` source (`setSource('async', {state,message,version})`)
  — so `pending{version}` → `valid|invalid` lands on `ElementInternals.setValidity` for free, with the
  generation token preserved. Target is resolved explicitly (`useTargetField`), or via `for=` id-ref /
  `closest` / descendant. `validate(input)` drives a check; `notifyInputChange` supersedes/aborts; an
  inner control's `input`/`change` auto-drives when a validator is assigned.
- **Bootstrap:** `plugs/bootstrap.ts` now creates the resolution registry (window + document injector)
  and defines `async-validator-field`, alongside the #215 merge plug.
- **Conformance tests (peers to #215's):** `CustomValidatorResolutionRegistry.test.ts` (9) +
  `AsyncValidatorField.test.ts` (6) — versioning drops a superseded generation; cancellation aborts the
  in-flight request (signal torn down); emitted source conforms to the cross-plane contract; registry
  resolution + `UnknownResolutionError`; no-registry / no-validator guards. Full unit suite green (1993).
- **Demo (live-verified):** extended the Validity Merge Playground with two checks — async answer feeds
  a real merge field's `async` source end-to-end, and per-scope resolution (a scoped `cancellation`
  registry overrides the global `versioning`, proven by the aborted signal). Playwright against the live
  dev server: **9/9 invariants hold, zero console errors**.

### Note

Per-scope resolution is asserted **live in the demo** (it needs real injectors); the unit suite covers
the registry + runner wiring + versioning/cancellation. The `for`/`closest`/descendant target lookup is
re-evaluated on each emit, so a late-attached target id is picked up without rewiring.
