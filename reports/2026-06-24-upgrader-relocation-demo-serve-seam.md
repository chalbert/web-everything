# Upgrader relocation — the code-upgrader demo's `serve()` seam (#1777)

*2026-06-24 · prep grounding for the #1777 decision · sibling of [#1778 functional-renderer relocation] and the [MaaS serve-core seam report](2026-06-24-maas-serve-core-relocation-seam.md) (#1771).*

## The question

#1777 relocates the upgrader renderer family (`we:blocks/renderers/upgrader/`) out of WE per the
impl→FUI rule (#1282), as a prerequisite for deleting the shared WE component kernel (#1775,
`blockedBy: [1730, 1777, 1778, 1779]`). One consumer — the `code-upgrader` demo — imports MaaS
`serve()`, which is **still WE-resident** (its relocation is #1730, not done). FUI has no `serve()`.
The prep question: how to relocate #1777 cleanly given that one cross-family dependency.

## Grounding (consuming tree, both repos)

- **Kernel is in FUI already** — `fui:blocks/renderers/component/declarativeComponent.ts` exports
  `parseDefinition` / `defineFromDefinition` / `ShadowMode` / `generateClassSource` (#1767).
- **Library + tests + mockup demo are `serve()`-free** — they import only the kernel:
  `we:blocks/renderers/upgrader/upgraderEngine.ts:31` (`parseDefinition`, **value**),
  `we:blocks/renderers/upgrader/analyzers/versionMigration.ts:23` (value), the 8 unit tests, and
  `we:demos/mockup-to-standard-demo.ts:24`.
- **The `code-upgrader` demo has TWO independent kernel uses**:
  `we:demos/code-upgrader-demo.ts:20` (`parseDefinition`, `defineFromDefinition` — **kernel, value,
  `serve()`-free**, drives the live-element render at lines 121–128) and
  `we:demos/code-upgrader-demo.ts:19` (`serve`/`FORMS`/`ServeForm` from
  `we:blocks/renderers/module-service/moduleService.ts` — used **only** in the `livePane()`
  "served in any form" toggle, lines ~90–115).
- **`serve()` is WE-resident** until #1730 relocates `we:blocks/renderers/module-service/`.

## Why the alternatives are broken (skeptic-verified)

- **(a) Fold the code-upgrader demo + WE upgrader impl into #1730** (the #1778 precedent) — **broken.**
  The WE upgrader engine (`we:blocks/renderers/upgrader/upgraderEngine.ts:31`) and the WE `code-upgrader`
  demo (`we:demos/code-upgrader-demo.ts:20`) both *value*-import the kernel #1775 must delete, and those
  imports are `serve()`-free. Keeping them live "until #1730" leaves live kernel pins, so #1777 would
  resolve **without clearing its #1775 blocker** — a false unblock (#1730 would do the clearing, not
  #1777). #1778 was a valid fold only because its lone pin was a *test* (fully removable now) and its
  impl's sole remaining consumer was `moduleService`; #1777's pins are the engine + a kernel-pinning demo,
  both removable now.
- **(c) Block all of #1777 on #1730** — wrong: it couples the entirely `serve()`-free upgrader relocation
  to the `serve()`/#1771-gated MaaS relocation, violating decouple-build-from-timing for no technical need.
- **(d) Cross-origin `serve()` bridge from WE :3000** — a FUI-canonical demo would be demonstrating WE's
  `serve()`, not FUI's: architecturally misleading, plus a cleanup obligation, for one toggle.

## Recommendation (forced path)

**(b) Relocate everything now; defer ONLY the `serve()` form-toggle.**

- **In #1777 now:** build the FUI upgrader twin (engine + 5 analyzers + interpreter + planner + fixtures)
  importing the FUI kernel; relocate the 8 unit tests to FUI (delete WE copies); swap **both** WE demos to
  #701 FUI iframes and delete the WE upgrader library. The FUI `code-upgrader` demo keeps the full pipeline
  + **live element** (via kernel `defineFromDefinition`) — it simply omits the "served in any form" toggle.
  This removes **every** upgrader-family kernel pin → genuinely clears #1777 as a #1775 blocker.
- **Defer to #1730 (one small slice, blockedBy #1730):** re-add the `code-upgrader` `livePane()` form-toggle
  once FUI has `serve()`. This is the only piece that genuinely cannot exist in FUI today.

This honors decouple-build-from-timing, avoids dual-engine drift, opens no coverage gap (impl + tests move
together), and adds no misleading seam. The sole cost is a temporary absence of one demo feature (the
multi-form toggle) that is intrinsically `serve()`-dependent — tracked, cheap to restore.
