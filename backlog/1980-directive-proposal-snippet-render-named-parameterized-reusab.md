---
kind: decision
parent: "1975"
status: open
dateOpened: "2026-06-29"
dateStarted: "2026-06-30"
preparedDate: "2026-06-30"
relatedReport: reports/2026-06-29-directive-catalog-brainstorm.md
tags: [webdirectives, composition, directive, snippet, template-instantiation, validation-gate]
---

# Directive proposal — snippet + render (named, parameterized reusable markup block)

**Prepared (validation gate).** A go/no-go on **admitting** a net-new directive pair at the
[#1963 framework-parity bar](../docs/agent/block-standard.md#composition-rubric). Define a reusable markup block
once and render it by reference with arguments — the **markup-reuse answer that is not a component** (no styled,
named element; no shadow). Surveyed across the field in the catalog report
([§5/§12](/research/directive-catalog-brainstorm/)): Svelte 5 `{#snippet}`+`{@render}`, Marko `<macro>`, Angular
`<ng-template>`+`*ngTemplateOutlet`, Vue scoped slots. **Recommendation: GO.**

## Grounding digest

There is no `snippet`/`render`/`include`/`macro` directive in the webdirectives spec today (its directive table
runs `for-each`/`if`/`lazy`/`portal`/`switch`/`resource:loader`/`async:boundary`/`trusted:html`/`sanitize:content`,
[we:src/_includes/project-webdirectives.njk:330-384](../src/_includes/project-webdirectives.njk#L330-L384)) — so
reuse-without-a-component is an **uncovered case** (bar criterion 3). It maps cleanly onto the **Template
Instantiation** proposal (`createInstance` + a pluggable processor) — a real standards-track substrate
(criterion 4). It is distinct from a **component/block** (no styled named element, no shadow, no lifecycle) and
from **native `<slot>`** (shadow-scoped distribution, not light-DOM named reuse with explicit invocation), so no
statute overlap (skeptic pass-2).

## Axis framing

The reuse axis has three established answers and this card picks the **directive** one: a *component* (heavy —
styled named element + shadow), a *native `<slot>`* (projection within a shadow root), or a **named parameterized
markup block** rendered by reference (the snippet). Snippet is the DRY answer that costs **zero new elements** —
`snippet:define` is an inert `<template is="snippet" name>`, and `snippet:render` is a **void** invocation that
stamps it with args. Passing args to stamp a parameterized template is **projection / parameterization**
(tree-shape), not sort/filter/arithmetic — so it stays on the tree-shape side of the line, **provided args remain
values** (the skeptic's one caveat, folded below).

## Recommended path at a glance

| Question | Verdict | Why |
|---|---|---|
| Admit at the #1963 bar? | **GO** — admit the `snippet:define` + `snippet:render` pair | Uncovered reuse case (criterion 3); real substrate (Template Instantiation, criterion 4); tree-shape-clean; no overlap with `<slot>` or components. |
| One directive or a pair? | **A pair: `snippet:define` (Ⓣ inert) + `snippet:render` (void invocation)** | Define-once / render-by-ref are two distinct acts; the pair mirrors the field (`{#snippet}`/`{@render}`) and Template Instantiation's define-vs-instantiate split. |
| Tree-shape vs app-logic? | **Args are VALUES, not expressions evaluated in markup** | Skeptic pass-1 caveat — if `render` args ever carry inline computed expressions it drifts toward app-logic; spec keeps args as passed values. |

## The gate

- **Digest + verdict:** GO. Admit `snippet:define` + `snippet:render`, authored toward Template Instantiation.
- **Prior-art delta:** the spec has **no** markup-reuse directive; the field universally ships a snippet/macro/
  template-outlet. This card proposes the missing primitive — *and* fills the catalog's `include`/`macro`/`block`
  rows (§12) at their shared root.
- **Why not a fork:** the define/render **pairing** is forced by the two-act shape (define-once vs render-by-ref),
  not a coherent either/or; there is no second admission posture — a one-sided go/no-go.
- **Un-gate trigger:** none — buildable now over `<template>` + the directive registry; the Template
  Instantiation lift is a later migration.

## Example (proposed authoring)

```html
<!-- define once -->
<!-- snippet:define name="card" params="title, body" -->
  <article class="card"><h3>${title}</h3><p>${body}</p></article>
<!-- /snippet:define -->

<!-- render by reference, with args (values, not expressions) -->
<!-- snippet:render name="card" title="Hello" body="World" -->
<!-- snippet:render name="card" title="Again" body="Reused, zero new definition" -->
```

- **Framework analog:** Svelte 5 `{#snippet card(t,b)}…{/snippet}` + `{@render card('Hi','x')}`; Marko `<macro>`;
  Angular `<ng-template>` + `*ngTemplateOutlet`.
- **Substrate / migration target:** Template Instantiation (`createInstance` + a pluggable processor). Reuse
  *without* minting a component (no styled/named element, no shadow) — the DRY answer on the directive side.
- **Form: Ⓣ template** — `snippet:define` is an inert reusable `<template is="snippet" name>`; `snippet:render`
  is the (void) invocation that stamps it with args. Inert-hold is the whole point.

`Skeptic:` SURVIVES (refute-only sub-agent, four axes). Pass-1 (merit): `render name args…` does **not** cross to
computation — passing args to stamp a parameterized template is projection (tree-shape), not sort/filter/
arithmetic. Pass-2 (statute-overlap): distinct from native `<slot>` (shadow-scoped distribution) and from
components (no styled element) — no collision. Pass-3 (citation-scope): maps cleanly onto Template Instantiation,
satisfying criterion 4 with a real direction — not stretched. **Caveat folded:** spec must keep `render` args as
**values, not inline expressions**, or it drifts toward app-logic-in-markup.
