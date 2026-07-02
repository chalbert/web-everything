---
kind: decision
parent: "1975"
status: resolved
dateOpened: "2026-06-29"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: "#2144 — snippet directive pair build child (form per #1983; args-as-values fence + custom-node-surface rider per #1980 ruling)"
codifiedIn: one-off
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
`snippet:define` is an inert typed `<template type="snippet-define" name>` (per the [#1983 form ruling](1983-directive-form-standard-comment-vs-template-form-reconcile-t.md):
inert body → typed `<template>`; `is=` is not minted), and `snippet:render` is a **void, no-body** invocation —
#1983 classifies no-body directives as **structural annotation (Ⓐ)**, exact spelling left to the build.
Passing args to stamp a parameterized template is **projection / parameterization**
(tree-shape), not sort/filter/arithmetic — so it stays on the tree-shape side of the line, **provided args remain
values** (the skeptic's one caveat, folded below).

## Recommended path at a glance

| Question | Verdict | Why |
|---|---|---|
| Admit at the #1963 bar? | **GO** — admit the `snippet:define` + `snippet:render` pair | Uncovered reuse case (criterion 3); real substrate (Template Instantiation, criterion 4); tree-shape-clean; no overlap with `<slot>` or components. |
| One directive or a pair? | **A pair: `snippet:define` (Ⓣ inert) + `snippet:render` (void invocation)** | Define-once / render-by-ref are two distinct acts; the pair mirrors the field (`{#snippet}`/`{@render}`) and Template Instantiation's define-vs-instantiate split. |
| Tree-shape vs app-logic? | **Args are VALUES, not expressions evaluated in markup** | Skeptic pass-1 caveat — if `render` args ever carry inline computed expressions it drifts toward app-logic; spec keeps args as passed values. |

## Ruling — ratified 2026-07-02

- **Verdict: GO.** Admit the `snippet:define` + `snippet:render` pair at the #1963 bar, authored toward
  Template Instantiation. Build child:
  [#2144](2144-build-the-snippet-directive-pair-snippet-define-typed-templa.md).
- **Normative constraint (binding, folded from the prep skeptic):** `render` args are **values, not inline
  expressions** — no computed expressions evaluated in markup. A future proposal to admit expression args is a
  new decision, not an extension.
- **Form (settled, #1983 — reconciled into this item 2026-07-02):** define = inert typed
  `<template type="snippet-define" name params>` (Fork 1 (a); #1983's own catalog row); render = **no-body Ⓐ
  structural annotation** (#1983 names `snippet:render` explicitly as the no-body case) — exact spelling settled
  in the build child, not a fork here.
- **Authoring-surface rider (decider's amendment, this ruling):** the build should **consider a custom-node
  syntax as an additional authoring surface** for `snippet:render` — a `customNodes` recipe per
  [#2074](../docs/agent/block-standard.md#custom-node-recipes) — alongside the typed-template/Ⓐ form. An
  *additional surface*, not a second canonical form (#1983 untouched); the open's legality is governed by the
  reserved-delimiter policy (#2112).
- **Red-team (ratify pass, held):** (1) *"snippet is just `for-each` over a literal array"* — fails:
  `for-each` iterates data at **one** tree location; snippet is **by-name reuse across arbitrary locations**
  with named params — define-once/render-in-distant-spots is inexpressible as iteration. (2) *"reuse is already
  covered by `<template>` + JS cloning"* — fails: that is the imperative substrate, not declarative authoring;
  the field universally ships the declarative form (criterion 3), and Template Instantiation exists precisely
  because the substrate alone is insufficient. (3) Amendment premises grounded: the customNodes frame (#2074)
  and registration mechanism (#1986) are live statutes; #2112 is open but governs only the open's legality, not
  this admission — rider phrased as *consider*, so no dependency edge.

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

*(Example reconciled 2026-07-02 to the ratified [#1983 directive-form standard](1983-directive-form-standard-comment-vs-template-form-reconcile-t.md)
— the prep's original comment-boundary / `is="snippet"` spellings predate that ruling and are struck.)*

```html
<!-- define once: inert body → typed <template> (#1983 Fork 1 (a); catalog row `type="snippet-define"`) -->
<template type="snippet-define" name="card" params="title, body">
  <article class="card"><h3>${title}</h3><p>${body}</p></article>
</template>

<!-- render by reference, with args (values, not expressions) — a NO-BODY directive:
     #1983 Ⓐ structural annotation; exact spelling (config element vs empty typed template)
     is a build-child detail, not a fork here. Illustrative: -->
<template type="snippet-render" name="card" title="Hello" body="World"></template>
<template type="snippet-render" name="card" title="Again" body="Reused, zero new definition"></template>
```

- **Framework analog:** Svelte 5 `{#snippet card(t,b)}…{/snippet}` + `{@render card('Hi','x')}`; Marko `<macro>`;
  Angular `<ng-template>` + `*ngTemplateOutlet`.
- **Substrate / migration target:** Template Instantiation (`createInstance` + a pluggable processor). Reuse
  *without* minting a component (no styled/named element, no shadow) — the DRY answer on the directive side.
- **Form (per #1983):** `snippet:define` — inert body → typed `<template type="snippet-define" name>`; inert-hold
  is the whole point. `snippet:render` — no body → **Ⓐ structural annotation** (#1983 "Supported by default"
  names `snippet:render` explicitly as the no-body case); its concrete spelling is settled at build time.

`Skeptic:` SURVIVES (refute-only sub-agent, four axes). Pass-1 (merit): `render name args…` does **not** cross to
computation — passing args to stamp a parameterized template is projection (tree-shape), not sort/filter/
arithmetic. Pass-2 (statute-overlap): distinct from native `<slot>` (shadow-scoped distribution) and from
components (no styled element) — no collision. Pass-3 (citation-scope): maps cleanly onto Template Instantiation,
satisfying criterion 4 with a real direction — not stretched. **Caveat folded:** spec must keep `render` args as
**values, not inline expressions**, or it drifts toward app-logic-in-markup.
