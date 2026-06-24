---
kind: decision
status: resolved
relatedProject: webcomponents
relatedReport: reports/2026-06-24-upgrader-relocation-demo-serve-seam.md
preparedDate: "2026-06-24"
blocks: ["1775"]
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: "fui:blocks/renderers/upgrader/upgraderEngine.ts"
codifiedIn: "docs/agent/platform-decisions.md#relocation-granularity"
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

## Build-start grounding correction (2026-06-24 — ratified (b), then full import audit)

The prep grounding read only the **kernel + `serve()`** edges. A full audit of every import in the
upgrader tree (`grep` over `we:blocks/renderers/upgrader/`) found **two more cross-family deps** the FUI
twin would have to satisfy — both currently WE-resident, so a naive port creates FUI→WE backward module
edges (banned, same class as the `serve()` seam). The high-level call (relocate now, don't defer-all)
stands; the "defer ONLY `serve()`" detail does not. The three seams:

| seam | consumer | WE source | resolution |
| --- | --- | --- | --- |
| MaaS `serve()` | `code-upgrader` demo `livePane()` toggle | `we:blocks/renderers/module-service/moduleService.ts` | **defer** to #1730 (as ratified) — no FUI equivalent, runtime service |
| `compareSpecVersions` | `we:blocks/renderers/upgrader/versionMigrationPlanner.ts:24` | `we:capability-manifest/provider.ts:182` | **inline** — a 9-line pure semver compare with no own deps; copy into the FUI planner, no backward edge, no deferral |
| `jsxToHtml` | `we:blocks/renderers/upgrader/analyzers/frameworkAnalyzers.ts:20` (React lift) | `we:blocks/renderers/jsx/jsxToHtml.ts` | **sub-fork (below)** — WE's impl ≠ FUI's `@frontierui/component-compiler` one (105 vs 45 LOC; WE adds `jsxToHtmlWithDiagnostics` + `desugar` + `reverseEvents`); `we:blocks/__tests__/unit/renderers/upgrader-frameworks.test.ts` asserts on its output, so a swap risks golden drift; WE's `jsxToHtml` itself pulls `./directives` + `render-strategy` types (the WE jsx subsystem, out of #1777 scope) |

### Fork 2 — the `frameworkAnalyzers` `jsxToHtml` seam (RESOLVED → (C), ratified 2026-06-24)

**Outcome:** ratified **(C)** — frameworkAnalyzers rewired to FUI's own `jsxToHtml` via the new
browser-safe `@frontierui/component-compiler/jsxToHtml` subpath export (the package root re-exports the
Node-side `@frontierui/compiler`, which externalizes `node:fs` in the browser). **Zero golden drift** —
all 9 `upgrader-frameworks` tests passed unchanged against FUI's renderer, so no re-baseline was needed
and no fallback-to-(A) deferral occurred. The headline demo is intact (verified in-browser: 21/21 cases,
React/Lit/Vue lifts render live).

**Demo-centrality (the fact that reweights this fork):** the `code-upgrader` demo *registers*
`frameworkAnalyzers` (`we:demos/code-upgrader-demo.ts:30`) and its framework-lift (React/Lit/Vue → web
component) is the demo's **headline** capability — not a peripheral toggle like `serve()`. So deferring
`frameworkAnalyzers` does not "trim" the FUI demo, it **guts** it. (`mockup-to-standard` is unaffected — it
registers only `mockupAnalyzer`.) Only the **React** path actually calls `jsxToHtml` (3 of 8 framework
fixtures: `react-static`/`react-dynamic-child`/`react-single-word-name`; Lit/Vue use string transforms).

| option | what it does | verdict |
| --- | --- | --- |
| (A) defer `frameworkAnalyzers` to a jsx-relocation slice | relocate engine + interpreter + planner + other 4 analyzers + fixtures + tests now; leave `frameworkAnalyzers` + `upgrader-frameworks.test` WE-resident | structurally clean (it doesn't pin the kernel) **but guts the demo's headline** — the FUI `code-upgrader` would lose React/Lit/Vue lifting, leaving only legacy-WC + model paths |
| (B) port WE's `jsxToHtml` (+`directives`(225) +`JSXRenderer` + `render-strategy` types) into FUI | drags a ~400+ LOC slice of the separate WE jsx renderer family into #1777 | scope creep — pulls an unrelated, separately-relocatable subsystem; #1777 balloons; that family needs its own #1282 relocation anyway |
| **(C) rewire `frameworkAnalyzers`'s React path to FUI's `@frontierui/component-compiler` `jsxToHtml`** | the relocated analyzer uses FUI's own canonical JSX→HTML (its architecturally-correct renderer) instead of WE's; re-baseline the 3 `react-*` goldens if output differs | **recommended** — keeps the demo whole, no scope creep, and a FUI analyzer *should* use FUI's renderer (using WE's would itself be a backward edge). Bounded cost: verify/adjust 3 React goldens. Only risk: FUI's 45-LOC impl lacks WE's lossy-diagnostic/desugar nuance, so a fixture may need its expected-HTML updated (a re-baseline, not a regression). |
| (D) inline a minimal `jsxToHtml` in the FUI upgrader | duplicate a partial impl | drift; two jsxToHtml impls |

**Recommendation: (C)**, confidence medium. The relocated, FUI-resident `frameworkAnalyzers` *should*
depend on FUI's canonical `jsxToHtml`, not reach back into WE — that makes (C) the architecturally-honest
choice, keeps the headline demo intact, and avoids hauling the whole WE jsx subsystem (B) or gutting the
demo (A). Residual: the two impls differ, so I must run `upgrader-frameworks.test` against FUI's renderer
and re-baseline any of the 3 React goldens that legitimately shift — if a case can't be made to pass
without lossy-diagnostic behavior FUI lacks, that single case falls back to (A)-style deferral. This is
the one open call before the build; `serve()` (defer) and `compareSpecVersions` (inline) are settled.
