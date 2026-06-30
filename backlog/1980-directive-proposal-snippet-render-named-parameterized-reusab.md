---
kind: decision
parent: "1975"
status: open
dateOpened: "2026-06-29"
tags: []
---

# Directive proposal — snippet + render (named, parameterized reusable markup block)

Net-new directive candidate (#1975 catalog). Define a reusable markup block once and render it by reference with arguments — Svelte 5 snippet plus render, Marko macros, Angular template-outlet, Vue scoped slots. Maps cleanly onto the native Template Instantiation proposal (createInstance + processor). The markup-reuse answer that is not a component. Decide at the #1963 bar.

## Example (proposed authoring)

```html
<!-- define once -->
<!-- snippet:define name="card" params="title, body" -->
  <article class="card"><h3>${title}</h3><p>${body}</p></article>
<!-- /snippet:define -->

<!-- render by reference, with args -->
<!-- snippet:render name="card" title="Hello" body="World" -->
<!-- snippet:render name="card" title="Again" body="Reused, zero new definition" -->
```

- **Framework analog:** Svelte 5 `{#snippet card(t,b)}…{/snippet}` + `{@render card('Hi','x')}`; Marko `<macro>`; Angular `<ng-template>` + `*ngTemplateOutlet`.
- **Substrate / migration target:** Template Instantiation (`createInstance` + a pluggable processor). Reuse *without* minting a component (no styled/named element, no shadow) — the DRY answer on the directive side.
- **Form: Ⓣ template** — `snippet:define` is an inert reusable `<template is="snippet" name>`; `snippet:render` is the (void) invocation that stamps it with args. Inert-hold is the whole point.
