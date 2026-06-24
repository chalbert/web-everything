---
kind: decision
status: open
relatedProject: webcomponents
relatedReport: reports/2026-06-24-upgrader-relocation-demo-serve-seam.md
preparedDate: "2026-06-24"
blocks: ["1775"]
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
tags: [placement, zero-implementation, renderers, upgrader, relocation-ordering]
---

# Relocate the upgrader renderer family out of WE per #1282 (impl→FUI)

The upgrader impl lives WE-resident at we:blocks/renderers/upgrader/ — upgraderEngine + transformInterpreter + versionMigrationPlanner + 5 analyzers + fixtures. #1282 (resolved) withdrew WE's reference-impl tier (WE = contract/vectors only), so this runtime belongs in FUI. Build the FUI upgrader family importing the FUI component kernel (#1767), relocate the unit tests, swap the WE consumer demos (mockup-to-standard, code-upgrader) to #701 FUI iframes; KEEP in WE only the contract + conformance vectors. Prereq for deleting the shared component kernel (#1775) — upgrader.test + 2 demos value-import it. See the Decision section for the prepared serve()-seam call.

## Decision (converted from story → decision 2026-06-24; prepared)

**What you decide:** how to relocate the upgrader family given that its `code-upgrader` demo uses MaaS
`serve()`, which is still WE-resident (#1730, not done). Ratify the recommended path (Fork 1 (b)) or
override. See the [relatedReport](../reports/2026-06-24-upgrader-relocation-demo-serve-seam.md) and the
published [/research/ topic](/research/upgrader-relocation-demo-serve-seam/).

### Grounding (consuming-tree read, both repos)

- **Kernel is already in FUI** — `fui:blocks/renderers/component/declarativeComponent.ts`
  (`parseDefinition` / `defineFromDefinition` / `ShadowMode`, #1767).
- **Library + 8 unit tests + the `mockup-to-standard` demo are `serve()`-free**, importing only the
  kernel: `we:blocks/renderers/upgrader/upgraderEngine.ts:31` (value), `we:demos/mockup-to-standard-demo.ts:24`.
- **The `code-upgrader` demo has TWO independent kernel uses**: `we:demos/code-upgrader-demo.ts:20`
  (`parseDefinition`/`defineFromDefinition` — kernel, **`serve()`-free**, drives the live-element render)
  and `we:demos/code-upgrader-demo.ts:19` (`serve`/`FORMS`/`ServeForm` from
  `we:blocks/renderers/module-service/moduleService.ts` — used **only** in the `livePane()` form-toggle,
  lines ~90–115). `serve()` is WE-resident until #1730.
- **#1775** (delete the shared kernel) is `blockedBy: [1730, 1777, 1778, 1779]`; it can only run once
  every WE-resident *value*-import of the kernel is gone.

### Supported by default (no fork — forward-port now)

The `serve()`-free 90% has no genuine fork — relocate it this story: build the FUI upgrader twin (engine +
5 analyzers + `transformInterpreter` + `versionMigrationPlanner` + fixtures) importing the FUI kernel,
relocate the 8 unit tests (delete WE copies), swap the `mockup-to-standard` demo to a #701 FUI iframe
(delete WE TS), delete the WE upgrader library. Keep in WE only the contract + any conformance vectors.

### Fork 1 — the `code-upgrader` demo's `serve()` seam

*Fork-existence: this is a forced invariant, not an open either/or — every alternative to (b) is broken
(below), so the call is a ratification that we take the forced path. The deferred toggle is `serve()`-bound
and intrinsically cannot exist in FUI until #1730; the demo's **blocking** pin is the kernel
(`defineFromDefinition`, `serve()`-free), which must be removed now.*

| option | what it does | verdict |
| --- | --- | --- |
| (a) fold the demo + WE impl into #1730 (the #1778 precedent) | keep WE upgrader impl + WE `code-upgrader` demo live "until #1730" | **broken** — both *value*-import the kernel (`we:blocks/renderers/upgrader/upgraderEngine.ts:31`, `we:demos/code-upgrader-demo.ts:20`), `serve()`-free; leaving them live means #1777 resolves **without clearing its #1775 pin** (false unblock; #1730 would clear it, not #1777). #1778 was valid only because its lone pin was a test. |
| **(b) [default] relocate everything now; defer ONLY the `serve()` toggle** | build the FUI `code-upgrader` demo with the full pipeline + live element (kernel `defineFromDefinition`), **minus** the "served in any form" toggle; swap the WE page to a #701 iframe; delete the WE library. Re-add the toggle in a small slice **blockedBy #1730**. | **recommended** — removes every kernel pin (genuinely clears #1777 for #1775); honors decouple-build-from-timing; no dual-engine drift; no coverage gap; the sole deferral is one intrinsically `serve()`-bound feature. |
| (c) block all of #1777 on #1730 | sequence the whole story after MaaS | wrong — couples `serve()`-free work to the `serve()`/#1771-gated #1730 for no technical need. |
| (d) cross-origin `serve()` bridge from WE :3000 | FUI demo imports WE's `serve()` over a 2nd origin | wrong — a FUI-canonical demo demonstrating WE's `serve()` is misleading, plus cleanup debt, for one toggle. |

**Skeptic:** REFUTED the original fold-default (a) — it leaves live `serve()`-free kernel pins in the WE
engine + demo, so #1777 wouldn't clear its #1775 blocker (false unblock). Amended default → **(b)**:
relocate all kernel-pinning code now, defer only the `livePane()` `serve()` toggle. (b) survived re-attack
(double-maintenance, coverage-gap, "is it just #1778" all resolve in (b)'s favour).

### On ratify (b)

Decision resolves → opens the build: the forward-port above (FUI twin + tests + both demo swaps + WE
library delete) executes this story; a new small slice "re-add `code-upgrader` form-toggle in FUI"
is filed `blockedBy #1730`.
