---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["214", "215"]
dateOpened: '2026-06-09'
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
