# Directive authoring forms — prep research for #1983

**Decision:** [#1983](../backlog/1983-directive-form-standard-comment-vs-template-form-reconcile-t.md) ·
parent epic [#1975](../backlog/1975-directive-catalog-epic.md) · 2026-06-30 ·
research topic: [`directive-authoring-form`](../src/_data/researchTopics/directive-authoring-form.json) ·
builds on [2026-06-29 directive-catalog brainstorm](2026-06-29-directive-catalog-brainstorm.md).

## Why this report exists

#1983 was scaffolded with a cold recommendation ("comment-boundary + plain `<template>` form for **all**
directives") and a contradiction table asserting that built `if`/`for-each`/`switch` use the `CustomComment`
comment-form while `portal`/`CustomTemplateDirective` use `<template is=>`. Prep grounded those claims against
the real FUI tree and found the premise **stale** — which flips the default.

## Ground truth (verified in `frontierui/`)

| Directive | Real mechanism | Authored as | `is=`? | Cross-browser? |
|---|---|---|---|---|
| `view:if` | `CustomAttribute` on `<template>` | `<template view:if="@state.loggedIn">…</template>` | no | ✅ |
| `view:switch` | `CustomAttribute` on `<template>`, nested `<template case>` | `<template view:switch="@s.status"><template case="…">…</template></template>` | no | ✅ |
| `for-each` | `CustomAttribute` on `<template>` | `<template for-each="…">…</template>` | no | ✅ |
| `portal` | `CustomTemplateDirective` (customized built-in) | `<template is="portal-directive" target="…">` | **yes** | ❌ Safari-never |
| `resource:loader` (spec, not built) | `CustomComment` boundary + `multiTemplate` | `<!-- resource:loader -->` + `<template slot>` | no | ✅ |

Citations: `fui:blocks/view/ViewIfDirective.ts:31,46-62`; `fui:blocks/view/ViewSwitchDirective.ts:34,52-68,104-120`;
`fui:blocks/view/registerViewDirectives.ts:13-17`; `fui:blocks/for-each/ForEachBehavior.ts:59`;
`fui:plugs/webportals/PortalDirective.ts:123`; `fui:plugs/webportals/index.ts:51-59`;
`fui:plugs/webdirectives/CustomTemplateDirective.ts:46-48`; `fui:plugs/webdirectives/CustomComment.ts:27-34`;
`fui:plugs/webdirectives/CustomCommentParser.ts:34`; `fui:plugs/webdirectives/multiTemplate.ts:19-23,30-74`.

**Correction:** the built control-flow directives are already `is=`-free **attribute-on-`<template>`** — the
exact Alpine/Vue/Angular structural-directive form. The only `is=` directive is `portal`. So the contradiction
is real (#1963 vs `portal`) but narrow, and the item's "comment-form for all" default contradicts what shipped.

## Prior-art survey (Finding detail in the research topic)

- **F1** — no mainstream framework uses customized built-ins (`is=`) for directives; WebKit declined to
  implement them. Corroborates #1963 from the prior-art side.
- **F2** — single-region runtime-HTML form converges on **attribute-on-`<template>`** (Alpine `<template
  x-if>`, Vue `<template v-if>`, Angular `*ngIf`→`<ng-template [ngIf]>`).
- **F3** — paired comment/brace boundaries are **compiler output / runtime markers** (Svelte `{#if}{/if}`),
  not the primary hand-authored form. WE uses the comment boundary as the SSR/runtime expansion of
  attribute-on-template directives, and as the authoring form only for the multi-region case.
- **F4** — **region count** is the real discriminator. WE shipped two clashing multi-region forms (switch's
  nested `<template case>` vs resource's comment-boundary `<template slot>`) → a genuine fork.
- **F5** — inert attribute-body = **fail-closed** (no flash-of-unauthorized-content); comment-boundary
  live-body = **fail-open** footgun for gating directives. SSR satisfies PE for both, so the live-body's only
  unique benefit is the fail-open path.

## Resulting prepared shape

- **Forced invariant (ratify):** `is=` is not minted as the directive-form contract; migrate `portal` off the
  customized built-in. Reworded to honor #1963's "nothing forbidden" — the blessed/minted form is `is=`-free;
  `is=` stays accepted-for-authors (a lower-compliance opt-in), not a first-class WE contract.
- **Fork 1 — single-region form:** attribute-on-`<template>` *(default)* vs comment-boundary.
- **Fork 2 — multi-region form:** nested `<template case>` inside one `<template attr>` *(default)* vs
  comment-boundary + sibling `<template slot>`.

The selection rule (region-count → form) becomes the codified output, not a fork. Codifies into
`we:docs/agent/block-standard.md` (directive section), composing with #1963 and the #1321 packaging governance.

## Skeptic pass (folded into the item)

- **Forced invariant:** SURVIVES-WITH-AMENDMENT — strike "No `is=` anywhere"; reword to "accepted-for-authors,
  not minted as contract"; justify portal migration via #1963's *never-load-bearing*, not "forbidden."
- **Fork 1:** the scaffold's comment-boundary default REFUTED (zero prior art, fail-open) → flipped to
  attribute-on-`<template>` (built form, universal precedent, fail-closed).
- **Fork 2:** SURVIVES-WITH-AMENDMENT → flip to nested-templates (uniform with Fork 1; migrate the *unbuilt*
  `resource:loader` spec, not the built `switch`).
