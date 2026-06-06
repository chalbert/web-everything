---
type: idea
status: active
dateOpened: '2026-06-06'
dateStarted: '2026-06-06'
tags:
  - rendering
  - render-strategy
  - jsx
  - compiler
relatedReport: reports/2026-06-06-render-strategy-axis.md
relatedProject: webcomponents
crossRef: { url: /projects/webcomponents/#render-strategy-lowering, label: Cross-strategy lowering }
---

# Build the cross-strategy lowering / lifting compiler

Implement the §4 correspondence contract from the [Render Strategy report](reports/2026-06-06-render-strategy-axis.md): **lower** JS control-flow into declarative-static primitives and **lift** them back. Concretely, extend `htmlToJsx` / `jsxToHtml` (`blocks/renderers/jsx/`, already proven for same-strategy spelling) to cross strategies, driven by the directive/strategy registry rather than hardcoded:

- `items.map(i => …)` ⇄ `<template is="for-each" items key>` — structural, reversible
- `cond && <X/>` / ternary ⇄ `<template is="if" condition>` — structural, reversible
- `onclick={namedFn}` ⇄ `on:click="namedFn($event)"` — reversible for named handlers; inline closures one-way
- `{expr}` (eager) ⇄ `{{ expr }}` (reactive path) — **declared lossy**: pick the `bind-*` convention or emit a diagnostic

Also resolves the Axis-1 leftover (feature-mapping row 8): which canonical HTML spelling — comment-form vs `<template>` element — a lift emits.

**Acceptance:** structural control-flow round-trips with tests; the lossy `{}`⇄`{{ }}` boundary is pinned by a *failing-by-design* test asserting the documented convention/diagnostic, not silent corruption. Depends on **#077** (needs the registry seam).

## Progress
- **Status:** active — implementation landed and green; ready for review/close.
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - New `blocks/renderers/jsx/render-strategy/crossStrategy.ts` — `lower(vdom)` / `lift(declarative)` returning `{ code, lossy, diagnostics }`. Implements the report §4 correspondence: `.map()` ⇄ `<template is="for-each" items item [key]>` (alias preserved via `item=`), `&&` / `cond ? x : null` ⇄ `<template is="if" condition>`, `onEVENT={namedFn}` ⇄ `on:EVENT="fn($event)"`, eager `{expr}` ⇄ reactive `{{ expr }}`.
  - **Lossy boundary pinned with diagnostics** (never silent): inline-closure handlers, eager↔reactive interpolation, and the `bind-text` reactive-attribute collapse each raise a `Diagnostic` and set `lossy:true`. A *failing-by-design* test asserts `lower(lift('<span bind-text="count"></span>'))` does NOT round-trip to the original (`bind-text` canonicalises to `{{ }}`), and that the compiler flagged it.
  - Exported from the `render-strategy` barrel; project page §render-strategy-lowering updated to note the reference compiler + diagnostics.
  - Tests: `blocks/__tests__/unit/renderers/crossStrategy.test.ts` (17 tests) — per-rule lower/lift, structural round-trips, lossy pins. Full renderer suite **160/160 green**; `tsc --noEmit` clean on new files; `check:standards` 0 errors.
- **Next:** none for #078. Remaining chain: **#079** (strategy toggle UI — can now show vdom↔declarative panes via this compiler), **#080** (freeze the runtime `RenderInput`/trigger contract).
- **Notes:** Pattern-based (no full JSX parser), matching the lean `jsxToHtml` style — documented limits in the module header: single-element map/if bodies, text-position interpolation only, named-handler events, explicit `item=` alias (reconciling with For-Each's item-relative `data-bind` is a follow-up). The `item=` alias choice is what makes the structural transform cleanly reversible.
