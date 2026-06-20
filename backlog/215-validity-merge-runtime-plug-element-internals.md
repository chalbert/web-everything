---
kind: story
size: 8
status: resolved
dateOpened: '2026-06-08'
blockedBy: ["212"]
dateStarted: '2026-06-08'
dateResolved: '2026-06-08'
graduatedTo: plugs/webvalidation/ + demos/validity-merge-demo.html
tags:
  - validation
  - registry
  - validity-model
  - runtime
  - element-internals
  - native-first
relatedReport: reports/2026-05-30-form-validation-standard-assessment.md
relatedProject: webvalidation
parent: "004"
---

# Runtime `customValidityMerge` plug — wire the strategy plane into a real control

#212 ships the **spec-site standalone model** of the validity-merge strategy plane
(the `CustomValidityMergeStrategy` contract, the source-reduction + last-write-wins
strategies, the registry, and the auto-stamping orchestrator — all dependency-free,
mirroring `capabilities/`). What's still missing is the **runtime plug**: the actual
`window.customValidityMerge` that resolves through the injector chain and drives a
live form control.

**Build:**
- A `plugs/`-side implementation exposing `window.customValidityMerge` as a real
  `CustomRegistry<CustomValidityMergeStrategy>` (not the standalone model), resolved
  per-scope via the injector chain (nearest-scope-wins, #207 D6).
- Bind the orchestrator's `MergedValidity` to a custom control's
  [`ElementInternals.setValidity`](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/setValidity)
  so the merged state drives native `:user-invalid`/`:invalid` styling — answering
  the webvalidation `user-invalid` open question (does a custom control get
  `:user-invalid` for free, or must we re-expose touched/dirty?).
- A demo/conformance page feeding the four named sources (native/schema/async/manual)
  live, showing source-reduction vs last-write-wins swapped with zero control edits.

Depends on #212 (the contract + strategies). Slots into the capability-provider
resolution work (#203–#207) for the per-scope resolution. See #004 OP-1/OP-11.

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - `plugs/webvalidation/` runtime plug:
    - `CustomValidityMergeRegistry` — extends core `CustomRegistry<CustomValidityMergeStrategy>`
      (injector-chain-resolvable), with `define(strategy, asDefault?)` / `resolve(key?)`. Reuses
      the `validity-merge/` (#212) strategies + auto-stamping orchestrator verbatim — the merge math
      has one home, no drift.
    - `applyMergedValidity` — pure `MergedValidity` → `ElementInternals.setValidity` sink (valid/idle
      → clear; pending/invalid → `customError` + message), unit-tested over a fake sink.
    - `<validity-merge-field>` — form-associated control resolving its strategy **per-scope** via
      `InjectorRoot.getProviderOf` (nearest-wins), feeding the four named sources into the
      orchestrator and pushing each merged result to `setValidity`. Emits `validity-merge`.
  - Wired `window.customValidityMerge` (source-reduction default + last-write-wins) and the element
    into `we:plugs/bootstrap.ts`.
  - `we:demos/validity-merge-demo.html/.ts/.css` — a conformance playground: 6 green invariant badges
    (strictest-wins, pending-beats-valid, strategy swap, native validity binding, per-scope
    resolution, default registry) **plus** a live sandbox feeding the four sources and swapping
    source-reduction ↔ last-write-wins with zero control edits. Registered in `we:src/_data/demos.json`.
  - 26 unit tests green; full plugs + validity-merge suite (698) green; `check:standards` 0 errors;
    e2e `playgrounds.spec` covers the demo (loads green, no console errors).
- **Notes / findings:**
  - **`:user-invalid` open question answered.** A form-associated custom element that delegates to
    `setValidity()` participates in native `:invalid`/`:valid` **for free** (verified live). The
    user-interaction gate behind `:user-invalid` is the **platform's** — the control never re-exposes
    touched/dirty. (Headless/synthetic interaction trips it for *neither* a native `required` input
    *nor* the FACE — it needs genuine user interaction — so the demo styles `:invalid` immediately and
    `:user-invalid` activates on a real failed-submit; the blocked-submit path fires the `invalid`
    event, which the demo surfaces.)
  - Per-scope resolution rides the existing `InjectorRoot.getProviderOf` (nearest-wins); #207 (the
    formal injector-chain cascade) stays open but this aligns with its D6.
  - **Leftover → #218:** auto-derive the `native` source from the inner control's `ValidityState`
    (currently every source, including `native`, is fed by hand). The `async` source's auto-wiring is
    the separate `CustomValidatorResolution` plane (#214).
