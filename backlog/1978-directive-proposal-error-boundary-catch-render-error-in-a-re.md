---
kind: decision
parent: "1975"
status: open
dateOpened: "2026-06-29"
tags: []
---

# Directive proposal — error boundary (catch render error in a region, render fallback)

Net-new directive candidate (#1975 catalog). Catch errors thrown while rendering a subtree and render a fallback region instead of propagating. Shipped by Solid, React, Vue, Svelte 5 and Angular (defer-scoped) but with no platform analog. Tree-shape clean. Decide at the #1963 bar.

## Example (proposed authoring)

```html
<!-- error:boundary -->
  <risky-widget></risky-widget>
  <template slot="fallback" let="err"><p class="error">Something broke: ${err.message}</p></template>
<!-- /error:boundary -->
```

- **Framework analog:** Solid `<ErrorBoundary fallback={…}>`, Svelte 5 `<svelte:boundary>`, React error boundaries, Angular `@error`.
- **Note:** catches render/connect errors in the bounded region and stamps the `fallback` slot instead of propagating; pairs with `async:await`'s `catch` (#1976) for async vs sync errors.
- **Form: Ⓒ comment + Ⓣ fallback** — the guarded region is **live** (comment-anchored, renders normally so errors can be observed); the `fallback` is an inert `<template>` stamped only on error.
