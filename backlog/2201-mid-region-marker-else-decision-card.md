---
kind: decision
status: open
parent: "2094"
dateOpened: "2026-07-03"
tags: [custom-nodes, delimiter-grammar, region, mid-marker, decision]
---

# Mid-region-marker (`{{else}}` / `{:else}` / `@else`) decision card

## Context

The #2114 Handlebars/Mustache delimiter bundle grammar-fidelity scorecard (scored via #2113) confirmed the **mid-region-marker** as a model gap: the #2074 `customNodes` recipe model can express a region's open (`{{#if}}`) and its close (`{{/if}}`), but the `{{else}}` marker that divides the if-body from the else-body has **no recipe axis**.

The same gap appears in every bundle that has conditional or alternation constructs:
- Handlebars: `{{else}}`
- Liquid/Jinja: `{% else %}`
- Blade: `@else`
- Svelte: `{:else}`

This is the *first confirming gap list* per the #2094 epic instruction ("the `{{else}}/{:else}/@else` mid-region-marker gets its decision card from the first confirming gap list, not a guess").

## The gap

A `{{#if cond}}…{{else}}…{{/if}}` block has THREE markers:
1. Open: `{{#if cond}}` — expressible as `HandlebarsIfNode` (`static open = '{{#if'`, `children:'inert'`)
2. **Mid-marker: `{{else}}`** — **no recipe axis in the #2074 model**
3. Close: `{{/if}}` — expressible as the `regionClose` echo

The mid-marker sits between two body segments. It is neither an open (does not start a region) nor a close (does not terminate the current region). It divides the region body into labelled segments — a construct the current model has no axis for.

## Forks

**Fork 1 — extend the recipe model with a `mid` static field** (a fourth axis alongside `value`/`children`/`marker`)

A `HandlebarsElseNode` would declare `static mid = '{{else}}'` keyed to its parent region kind. The registry's region walk, on encountering the mid-marker inside a region body, would split the body at that point — producing two named `<template>` slots in the `<template>` host (`.content` becomes a named fragment map).

Upside: closes the gap cleanly; the standard grows a new axis. Downside: the `<template>` host contract changes (callers currently read `.content`; now they'd read named slots). This is a standard-layer decision.

**Fork 2 — treat `{{else}}` as a named nested region (degenerate region)**

The author writes `{{#else}}…{{/else}}` (or a recipe intercepts `{{else` with a zero-close form). The else-body is itself an inert `<template>` nested inside the if-template's `.content`. This avoids a new axis but forces an authoring change (Handlebars' `{{else}}` is NOT `{{#else}}`).

Downside: does not reproduce the Handlebars grammar faithfully (the whole point of the bundle program).

**Fork 3 — out-of-scope: record `{{else}}` as a grammar gap; don't model it yet**

Leave the gap in the scorecard and the gap list; the bundles that need alternation document the gap row. Only grow the model when the full alternation use-case (Handlebars, Liquid, Svelte) is well-understood.

Upside: no premature standard growth. Downside: every framework bundle with alternation scores a gap.

## Recommendation

Fork 3 (park) until at least two more framework bundles (#2115 Liquid/Jinja, #2118 Svelte) confirm the gap and surface their mid-marker shapes — this gives the Fork-1 design the multi-framework evidence it needs before committing to a `mid` axis. File this card so the first bundle resolves its scorecard without blocking on the gap; the decision matures with the evidence.
